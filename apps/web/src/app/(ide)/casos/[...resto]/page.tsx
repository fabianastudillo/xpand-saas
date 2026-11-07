import { redirect } from "next/navigation";

// /casos/<uno solo> and /casos/<más de dos>: no such screen; the catalog is the way back (as the SPA's «*» route did).
export default function Page(): never {
  redirect("/casos");
}
