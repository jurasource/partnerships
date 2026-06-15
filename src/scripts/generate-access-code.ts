import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { accessCodes } from "@/db/schema";
import { hashCode } from "@/lib/auth/hash";

const label = process.argv[process.argv.indexOf("--label") + 1] ?? "unnamed";
const plaintext = randomBytes(16).toString("hex"); // 32-char hex code
const codeHash = await hashCode(plaintext);

await db.insert(accessCodes).values({ codeHash, label });
console.log(`\nAccess code for "${label}":\n\n  ${plaintext}\n\nStore this — it will not be shown again.\n`);
process.exit(0);
