export const dynamic = "force-dynamic";

import { authOptions } from "@/lib/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/tally/login");
  }

  const region = session.user.region;

  if (region === "india") {
    redirect("/tally/india");
  } else if (region === "nepal") {
    redirect("/tally/nepal");
  } else if(region === "all"){
    redirect("/tally/all");
  } else {
    return (
      <p className="text-center mt-20 text-red-600 font-semibold">
        Unknown region: access denied.
      </p>
    );
  }
}
