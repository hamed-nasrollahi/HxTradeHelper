import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USER_ID } from "@/lib/auth";
import { query } from "@/lib/db";
import { passwordResetMail, sendMail } from "@/lib/mail";
import { hashPassword, passwordProblem } from "@/lib/password";
import { HttpError, errorResponse, findUser, requireAdmin } from "@/lib/session";
import { markVerified } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * Admin actions on one user:
 *   { action: "confirm" }                     mark the email confirmed
 *   { action: "disable" } / { action: "enable" }
 *   { action: "resetPassword", password, sendEmail? }
 *   { action: "makeAdmin" } / { action: "removeAdmin" }
 * User #1 (the .env admin) can't be disabled, demoted or have its password
 * reset here, and admins can't disable or demote themselves.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const target = await findUser(Number(params.id));
    if (!target) throw new HttpError(404, "user not found");
    const body: any = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const protectedUser = target.id === ADMIN_USER_ID || target.id === admin.id;
    let emailed: boolean | undefined;

    switch (action) {
      case "confirm":
        await markVerified(target.id);
        break;
      case "disable":
      case "removeAdmin":
        if (protectedUser) {
          throw new HttpError(400, target.id === ADMIN_USER_ID ? "The main admin can't be changed" : "You can't do that to yourself");
        }
        await query(`UPDATE users SET ${action === "disable" ? "disabled = 1" : "is_admin = 0"} WHERE id = ?`, [target.id]);
        break;
      case "enable":
        await query("UPDATE users SET disabled = 0 WHERE id = ?", [target.id]);
        break;
      case "makeAdmin":
        await query("UPDATE users SET is_admin = 1 WHERE id = ?", [target.id]);
        break;
      case "resetPassword": {
        if (target.id === ADMIN_USER_ID) {
          throw new HttpError(400, "The main admin password is set with DASHBOARD_PASSWORD in .env");
        }
        const problem = passwordProblem(body.password);
        if (problem) throw new HttpError(400, problem);
        await query("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(body.password), target.id]);
        if (body.sendEmail) {
          if (!target.email) throw new HttpError(400, "Password changed, but the user has no email address");
          emailed = await sendMail(passwordResetMail(target.email, target.name, body.password));
        }
        break;
      }
      default:
        throw new HttpError(400, "unknown action");
    }
    return NextResponse.json({ ok: true, ...(emailed !== undefined ? { emailed } : {}) });
  } catch (e: any) {
    return errorResponse(e, "update failed");
  }
}
