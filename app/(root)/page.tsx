export const dynamic = "force-dynamic";

import { authOptions } from "@/lib/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const region = session.user.region;

  if (region === "india") {
    redirect("/india");
  } else if (region === "nepal") {
    redirect("/nepal");
  } else if(region === "all"){
    redirect("/all");
  } else {
    return (
      <p className="text-center mt-20 text-red-600 font-semibold">
        Unknown region: access denied.
      </p>
    );
  }
}
