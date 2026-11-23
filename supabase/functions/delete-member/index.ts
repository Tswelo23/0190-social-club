
// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (status: number, body: object) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

Deno.serve(async (req: Request) => {
  // Handle browser preflight requests.
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respond(405, {
      error: "Method not allowed.",
    });
  }

  try {
    // 1. Verify authentication.
    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return respond(401, {
        error: "Authentication required.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        "Required Supabase environment variables are missing."
      );
    }

    // Verify the person making the request.
    const callerClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();

    if (authError || !caller) {
      return respond(401, {
        error: "Invalid login session.",
      });
    }

    // Create privileged client only after authentication.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // 2. Verify that the caller is an active administrator.
    const { data: adminProfile, error: adminError } =
      await adminClient
        .from("profiles")
        .select("role, account_status")
        .eq("id", caller.id)
        .single();

    if (
      adminError ||
      adminProfile?.role !== "admin" ||
      adminProfile?.account_status !== "active"
    ) {
      return respond(403, {
        error: "Only active administrators can delete members.",
      });
    }

    // 3. Validate the requested member ID.
    const body = await req.json();
    const memberId = body?.memberId;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof memberId !== "string" ||
      !uuidPattern.test(memberId)
    ) {
      return respond(400, {
        error: "A valid member ID is required.",
      });
    }

    if (memberId === caller.id) {
      return respond(400, {
        error: "You cannot delete your own administrator account.",
      });
    }

    // 4. Verify that the target exists and is a member.
    const { data: member, error: memberError } =
      await adminClient
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", memberId)
        .maybeSingle();

    if (memberError) {
      throw new Error("Unable to verify the selected member.");
    }

    if (!member || member.role !== "member") {
      return respond(404, {
        error: "Member not found.",
      });
    }

    // 5. Check financial tables directly linked to member_id.
    const directFinancialChecks = [
      {
        table: "contributions",
        description: "savings or interest contributions",
      },
      {
        table: "fines",
        description: "fines",
      },
      {
        table: "loans",
        description: "loans",
      },
      {
        table: "other_payments",
        description: "other payments",
      },
    ];

    for (const item of directFinancialChecks) {
      const { data, error } = await adminClient
        .from(item.table)
        .select("id")
        .eq("member_id", memberId)
        .limit(1);

      if (error) {
        console.error(
          `Financial history check failed for ${item.table}:`,
          error
        );

        return respond(500, {
          error: `Unable to verify ${item.description}. No deletion was performed.`,
        });
      }

      if (data && data.length > 0) {
        return respond(409, {
          error:
            `Permanent deletion refused. This member has ${item.description}. ` +
            "Mark the member as a former member to preserve their financial history.",
        });
      }
    }

    // 6. Check fine payment history through fines.
    const { data: memberFines, error: finesError } =
      await adminClient
        .from("fines")
        .select("id")
        .eq("member_id", memberId);

    if (finesError) {
      throw new Error(
        "Unable to verify the member's fine history."
      );
    }

    const fineIds = (memberFines || []).map(
      (fine) => fine.id
    );

    if (fineIds.length > 0) {
      const { data: finePayments, error: paymentError } =
        await adminClient
          .from("fine_payments")
          .select("id")
          .in("fine_id", fineIds)
          .limit(1);

      if (paymentError) {
        throw new Error(
          "Unable to verify the member's fine payment history."
        );
      }

      if (finePayments && finePayments.length > 0) {
        return respond(409, {
          error:
            "Permanent deletion refused. This member has fine payment history. " +
            "Mark the member as a former member instead.",
        });
      }
    }

    // 7. Check loan repayment history through loans.
    const { data: memberLoans, error: loansError } =
      await adminClient
        .from("loans")
        .select("id")
        .eq("member_id", memberId);

    if (loansError) {
      throw new Error(
        "Unable to verify the member's loan history."
      );
    }

    const loanIds = (memberLoans || []).map(
      (loan) => loan.id
    );

    if (loanIds.length > 0) {
      const { data: repayments, error: repaymentError } =
        await adminClient
          .from("loan_repayments")
          .select("id")
          .in("loan_id", loanIds)
          .limit(1);

      if (repaymentError) {
        throw new Error(
          "Unable to verify the member's loan repayment history."
        );
      }

      if (repayments && repayments.length > 0) {
        return respond(409, {
          error:
            "Permanent deletion refused. This member has loan repayment history. " +
            "Mark the member as a former member instead.",
        });
      }
    }

    // 8. All financial checks passed.
    // Attempt to delete the Auth account.
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(memberId);

    if (deleteError) {
      console.error("Auth deletion failed:", deleteError);

      return respond(500, {
        error:
          "The member could not be permanently deleted. " +
          "Check the profiles-to-auth.users foreign key and its deletion rule.",
      });
    }

    return respond(200, {
      success: true,
      message: `${member.full_name || "Member"} was permanently deleted.`,
    });

  } catch (error: unknown) {
    console.error(
      "Delete member function error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error.";

    return respond(500, {
      error: message,
    });
  }
});
