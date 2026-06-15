"use server";
import { redirect } from "next/navigation";
import { clearSession } from "./session";

export async function logout(): Promise<never> {
  await clearSession();
  redirect("/login");
}
