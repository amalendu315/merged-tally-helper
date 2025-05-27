import axios from "axios";
import { NextResponse } from "next/server";

import { returnCloudURL, returnCloudAuthToken } from "@/constants/index";

interface ResponseType {
  data: [
    {
      statusmessage: string;
      statuscode: string;
      voucherno: string;
    }
  ];
}

export async function POST(request: Request) {
  try {
    const { data } = await request.json();

    // Submit the data to the cloud server using Axios
    const response: ResponseType = await axios.post(
      returnCloudURL,
      { data: data },
      {
        headers: {
          "Content-Type": "application/json",
          Authtoken: returnCloudAuthToken,
        },
      }
    );

    response?.data.map((r) => {
      if (r.statusmessage === "voucher number not found.") {
        return NextResponse.json({
          error: r.statusmessage,
          status: r.statuscode,
        });
      }
    });

    return NextResponse.json(response?.data);
  } catch (error) {
    console.error("Error submitting data:", error);
    return NextResponse.json(
      { error: "Failed to submit vouchers" },
      { status: 500 }
    );
  }
}
