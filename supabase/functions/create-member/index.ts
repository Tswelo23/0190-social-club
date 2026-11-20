// deno-lint-ignore-file
import { withSupabase } from "@supabase/server";


function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export default {
  fetch: withSupabase(
    { auth: "user" },
   async (req: Request, ctx: any) => {

      // Only allow POST requests
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405 }
        );
      }

      try {
        // Identify the authenticated user
        const adminId = ctx.userClaims?.id;

        if (!adminId) {
          return Response.json(
            { error: "Authentication required." },
            { status: 401 }
          );
        }

        // Verify the user's actual club role
        const { data: adminProfile, error: adminError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select("id, role, account_status")
            .eq("id", adminId)
            .maybeSingle();

        if (adminError) {
          console.error("Admin verification failed:", adminError);

          return Response.json(
            { error: "Unable to verify administrator permissions." },
            { status: 500 }
          );
        }

        if (
          !adminProfile ||
          adminProfile.role !== "admin" ||
          adminProfile.account_status !== "active"
        ) {
          return Response.json(
            { error: "You are not authorised to create members." },
            { status: 403 }
          );
        }

        // Read registration information
        const body = await req.json();

        const fullName =
          typeof body.fullName === "string"
            ? body.fullName.trim()
            : "";

        const email =
          typeof body.email === "string"
            ? body.email.trim().toLowerCase()
            : "";

        const memberNumber =
          typeof body.memberNumber === "string"
            ? body.memberNumber.trim()
            : "";

        const joinedAt =
          typeof body.joinedAt === "string"
            ? body.joinedAt.trim()
            : "";

        // Validate required fields
        if (
          fullName.length < 2 ||
          fullName.length > 120
        ) {
          return Response.json(
            { error: "Please enter a valid full name." },
            { status: 400 }
          );
        }

        if (
          email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
          return Response.json(
            { error: "Please enter a valid email address." },
            { status: 400 }
          );
        }

        if (
          memberNumber.length < 1 ||
          memberNumber.length > 30
        ) {
          return Response.json(
            { error: "Please enter a valid member number." },
            { status: 400 }
          );
        }

        if (!isValidDate(joinedAt)) {
          return Response.json(
            { error: "Please provide a valid joining date." },
            { status: 400 }
          );
        }

        // Check whether the member number is already registered
        const { data: existingMember, error: duplicateError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("member_number", memberNumber)
            .maybeSingle();

        if (duplicateError) {
          console.error("Member number check failed:", duplicateError);

          return Response.json(
            { error: "Unable to verify the member number." },
            { status: 500 }
          );
        }

        if (existingMember) {
          return Response.json(
            { error: "This member number is already registered." },
            { status: 409 }
          );
        }

        // Send an invitation and create the authentication account
        const { data: invitation, error: invitationError } =
          await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
          {
             data: {   
          full_name: fullName
          },
         redirectTo: Deno.env.get("INVITE_REDIRECT_URL")
         }
        );

        if (invitationError || !invitation.user) {
          console.error("Member invitation failed:", invitationError);

          return Response.json(
            {
              error:
                invitationError?.message ||
                "Unable to create the member account."
            },
            { status: 400 }
          );
        }

        const newUserId = invitation.user.id;

        // Update the automatically created member profile
        const { data: newProfile, error: profileError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .update({
              full_name: fullName,
              email: email,
              member_number: memberNumber,
              joined_at: joinedAt,
              membership_status: "active",
              account_status: "active",
              role: "member"
            })
            .eq("id", newUserId)
            .select(
              "id, full_name, email, member_number, joined_at, membership_status, account_status, role"
            )
            .single();

        if (profileError || !newProfile) {
          console.error("Profile update failed:", profileError);

          // Clean up the newly created account
          await ctx.supabaseAdmin.auth.admin.deleteUser(
            newUserId
          );

          return Response.json(
            { error: "The member profile could not be created." },
            { status: 500 }
          );
        }

        // Return the newly registered member
        return Response.json(
          {
            message: "Member successfully registered. Invitation sent.",
            member: newProfile
          },
          { status: 201 }
        );

      } catch (error) {
        console.error("Create member function error:", error);

        return Response.json(
          { error: "An unexpected error occurred." },
          { status: 500 }
        );
      }
    }
  )
};
