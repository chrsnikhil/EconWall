import { NextRequest, NextResponse } from "next/server";
import { getRegistrations, saveRegistration } from "@/lib/db";

export async function GET() {
    const params = getRegistrations();
    return NextResponse.json(params);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { subdomain, actualUrl, owner } = body;

        // Validation
        if (!subdomain || !/^[a-z0-9]{1,20}$/.test(subdomain)) {
            return NextResponse.json({ error: "Invalid subdomain. Use 1-20 lowercase alphanumeric characters." }, { status: 400 });
        }

        if (!actualUrl || !actualUrl.startsWith("http")) {
            return NextResponse.json({ error: "Invalid URL. Must start with http:// or https://" }, { status: 400 });
        }

        // Check for duplicates
        const db = getRegistrations();
        const ensName = `${subdomain}.econwall.eth`;
        if (db[ensName]) {
            return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });
        }

        // Save
        const result = saveRegistration(subdomain, actualUrl, owner);

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
