import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import nodemailer from "nodemailer";
import { validateSubmission } from "./validate";
import { subscriptionEndFrom } from "@/lib/subscription";
import type { JsonRecord } from "@/types";

export const dynamic = "force-dynamic";


export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const dataString = formData.get("data") as string;
    const profileId = formData.get("profileId") as string | null;
    if (!dataString) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    let jsonData: Record<string, unknown>;
    try {
      jsonData = JSON.parse(dataString);
    } catch {
      return NextResponse.json({ error: "Malformed data payload" }, { status: 400 });
    }

    /* Reject drifted or malformed submissions here rather than storing them in
       the jsonb blob, where a wrong field name surfaces only as a blank cell in
       the admin panel weeks later. */
    const validation = validateSubmission(jsonData);
    if (!validation.ok) {
      console.error("Rejected form submission:", validation.errors);
      return NextResponse.json(
        { error: "بيانات الاستمارة غير صالحة", details: validation.errors },
        { status: 400 }
      );
    }
    /* Validated above, so fullname is present and a string. */
    const fullname = String(jsonData.fullname ?? "").trim();
    const userId = `${Date.now()}_${fullname.replace(/[^a-zA-Z0-9]/g, '_') || 'user'}`;
    const userFolder = `usersData/${userId}`;

    const uploadedFiles: Record<string, string | string[]> = {};

    // Helper to upload a file to Supabase
    const uploadFile = async (file: File, path: string) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await supabaseAdmin.storage
        .from('uploads')
        .upload(path, buffer, {
          contentType: file.type,
          upsert: false
        });
      
      if (error) {
        console.error("Supabase upload error:", error);
        throw new Error("Failed to upload file");
      }
      
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('uploads')
        .getPublicUrl(path);
        
      return publicUrlData.publicUrl;
    };

    // Upload analysis_file
    const analysisFile = formData.get("analysis_file") as File | null;
    if (analysisFile && analysisFile.name) {
      uploadedFiles.analysis_file = await uploadFile(analysisFile, `${userFolder}/analysis_${analysisFile.name}`);
    }

    // Upload supplements_photo
    const supplementsPhoto = formData.get("supplements_photo") as File | null;
    if (supplementsPhoto && supplementsPhoto.name) {
      uploadedFiles.supplements_photo = await uploadFile(supplementsPhoto, `${userFolder}/supplements_${supplementsPhoto.name}`);
    }

    // Upload diet_history_file
    const dietHistoryFile = formData.get("diet_history_file") as File | null;
    if (dietHistoryFile && dietHistoryFile.name) {
      uploadedFiles.diet_history_file = await uploadFile(dietHistoryFile, `${userFolder}/diet_history_${dietHistoryFile.name}`);
    }

    // Upload body_photos (multiple)
    const bodyPhotos = formData.getAll("body_photos") as File[];
    if (bodyPhotos.length > 0) {
      const photoUrls = await Promise.all(
        bodyPhotos.map(async (file, index) => {
          if (file.name) {
            return await uploadFile(file, `${userFolder}/body_photo_${index}_${file.name}`);
          }
          return null;
        })
      );
      uploadedFiles.body_photos = photoUrls.filter(Boolean) as string[];
    }

    // Combine all data
    const finalData: Record<string, unknown> = {
      ...jsonData,
      ...uploadedFiles,
      is_new: true, // For admin notifications
    };

    let profile;

    if (profileId) {
      // It's a renewal
      const existingProfile = await prisma.profiles.findUnique({
        where: { id: profileId }
      });
      
      let existingData = existingProfile?.data as JsonRecord || {};
      if (typeof existingData === "string") {
        try { existingData = JSON.parse(existingData); } catch { existingData = {}; }
      }

      const history = existingData.history || [];
      const dataWithoutHistory = { ...existingData };
      delete dataWithoutHistory.history;
      
      const renewals = existingData.renewals || [];
      const currentMonthNumber = renewals.length + 1;
      const nextMonthNumber = renewals.length + 2;

      // Save previous state to history
      history.push({
        label: currentMonthNumber === 1 ? 'الشهر الأول' : `الشهر ${currentMonthNumber}`,
        date: new Date().toISOString(),
        data: dataWithoutHistory
      });

      renewals.push({
        date: new Date().toISOString(),
        label: `الشهر ${nextMonthNumber}`
      });

      finalData.renewals = renewals;
      finalData.history = history;
      finalData.is_renewal = true;

      profile = await prisma.profiles.update({
        where: { id: profileId },
        data: {
          username: fullname || existingProfile?.username || "Unknown User",
          data: finalData as Prisma.InputJsonObject,
          // Submitting the renewal form restarts the subscription period.
          subscription_ends_at: subscriptionEndFrom()
        }
      });
    } else {
      // Save to Prisma profiles
      profile = await prisma.profiles.create({
        data: {
          username: fullname || "Unknown User",
          data: finalData as Prisma.InputJsonObject,
        },
      });
    }

    // Send Email via Nodemailer
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const planName = jsonData.plan === "plan1" ? "خطط ذاتية التوجيه" :
                         jsonData.plan === "plan2" ? "خطة شهرية (متابعة أسبوعية)" :
                         jsonData.plan === "plan3" ? "خطة شهرية (متابعة يومية)" : jsonData.plan;

        await transporter.sendMail({
          from: `"Gym Portal" <${process.env.EMAIL_USER}>`,
          to: "ibrahim1996.im@gmail.com",
          subject: profileId ? `طلب تجديد اشتراك: ${jsonData.fullname}` : `مشترك جديد: ${jsonData.fullname}`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif;">
              <h2 style="color: #2563EB;">${profileId ? 'طلب تجديد اشتراك' : 'تسجيل مشترك جديد'}</h2>
              <p><strong>الاسم:</strong> ${jsonData.fullname}</p>
              <p><strong>الخطة المطلوبة:</strong> ${planName}</p>
              <p><strong>رقم الهاتف:</strong> ${jsonData.phone || jsonData.mobile || 'غير محدد'}</p>
              <p><strong>العمر:</strong> ${jsonData.age}</p>
              <br/>
              <p>يرجى الدخول للوحة التحكم لمشاهدة التفاصيل كاملة.</p>
            </div>
          `,
        });
      } else {
        console.warn("EMAIL_USER or EMAIL_PASS missing in .env. Skipping email notification.");
      }
    } catch (emailErr) {
      console.error("Failed to send email notification:", emailErr);
      // We don't fail the submission if email fails
    }

    return NextResponse.json({ success: true, profileId: profile.id });
  } catch (error) {
    console.error("Submit form error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
