import axios from "axios";
import { NextResponse } from "next/server";

import { purchaseCloudURL, purchaseCloudAuthToken } from "@/constants";

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
      purchaseCloudURL,
      { data: data },
      {
        headers: {
          "Content-Type": "application/json",
          Authtoken: purchaseCloudAuthToken,
        },
      }
    );

    return NextResponse.json(response?.data);
  } catch (error) {
    console.error("Error submitting data:", error);
    return NextResponse.json(
      { error: "Failed to submit vouchers" },
      { status: 500 }
    );
  }
}
