import axios from "axios";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { salesURL, authorization, cookie } from "@/constants";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const formattedStartDate = startDate?.replace(/-/g, "/");
    const formattedEndDate = endDate?.replace(/-/g, "/");

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: salesURL,
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        Cookie: cookie,
      },
      data: {
        from_date: formattedStartDate,
        to_date: formattedEndDate,
      },
    };

    const response = await axios.request(config);
    if (response?.data?.code === "404") {
      return NextResponse.json({ error: "No Data Found" }, { status: 404 });
    }
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales entries" },
      { status: 500 }
    );
  }
}
