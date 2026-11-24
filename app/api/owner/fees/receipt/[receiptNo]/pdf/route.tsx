import { NextRequest, NextResponse } from "next/server";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatLKR } from "@/lib/money";
import type { CollegeProfile, FeeRecord, Student } from "@/types";

interface RouteParams {
  params: Promise<{ receiptNo: string }>;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1C1F23",
    backgroundColor: "#FFFFFF",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    paddingBottom: 15,
    marginBottom: 20,
    textAlign: "center",
  },
  collegeTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  collegeSubtitle: {
    fontSize: 9,
    color: "#5F6670",
    marginBottom: 2,
  },
  badge: {
    marginTop: 8,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    padding: 10,
  },
  metaCol: {
    width: "50%",
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 8,
    color: "#5F6670",
    textTransform: "uppercase",
    marginBottom: 1,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  table: {
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    padding: 8,
  },
  tableRow: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
  },
  tableFooter: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    padding: 10,
  },
  colDesc: {
    flex: 3,
  },
  colAmt: {
    flex: 1,
    textAlign: "right",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  totalText: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
  },
  footerNotice: {
    marginTop: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#5F6670",
  },
});

interface ReceiptDocProps {
  receiptNo: string;
  date: string;
  paymentMethod: string;
  amount: number;
  studentName: string;
  studentGrade: string;
  description: string;
  college: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
}

function ReceiptDocument({
  receiptNo,
  date,
  paymentMethod,
  amount,
  studentName,
  studentGrade,
  description,
  college,
}: ReceiptDocProps) {
  const formattedAmt = formatLKR(amount);
  const formattedDate = new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document title={`Receipt-${receiptNo}`}>
      <Page size="A5" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.collegeTitle}>{college.name}</Text>
          <Text style={styles.collegeSubtitle}>{college.address}</Text>
          {college.phone ? <Text style={styles.collegeSubtitle}>Tel: {college.phone}</Text> : null}
          <Text style={styles.badge}>Official Payment Receipt</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Receipt No</Text>
            <Text style={styles.metaValue}>{receiptNo}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date Issued</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Student Name</Text>
            <Text style={styles.metaValue}>{studentName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Grade / Academic Year</Text>
            <Text style={styles.metaValue}>{studentGrade || "Student"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Payment Method</Text>
            <Text style={styles.metaValue}>{paymentMethod.toUpperCase()}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Payment Status</Text>
            <Text style={styles.metaValue}>PAID (COMPLETED)</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, styles.bold]}>Description</Text>
            <Text style={[styles.colAmt, styles.bold]}>Amount (LKR)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>{description}</Text>
            <Text style={[styles.colAmt, styles.bold]}>{formattedAmt}</Text>
          </View>
          <View style={styles.tableFooter}>
            <Text style={[styles.colDesc, styles.bold]}>Total Paid</Text>
            <Text style={[styles.colAmt, styles.totalText]}>{formattedAmt}</Text>
          </View>
        </View>

        <Text style={styles.footerNotice}>
          Thank you for your payment. Please retain this official receipt for your records.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * GET /api/owner/fees/receipt/[receiptNo]/pdf
 * Generates and returns a downloadable/streamable PDF receipt.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { receiptNo } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    // 1. Fetch college profile
    const collegeDoc = await adminDb.collection("settings").doc("college").get();
    const collegeData = (collegeDoc.exists ? collegeDoc.data() : null) as CollegeProfile | null;

    const collegeInfo = {
      name: collegeData?.name || "Tutorial College",
      address: collegeData?.address || "Colombo, Sri Lanka",
      phone: collegeData?.phone || "",
      email: collegeData?.email || "",
    };

    // 2. Search tuition fee records
    const feesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("receiptNo", "==", receiptNo)
      .limit(1)
      .get();

    if (!feesSnap.empty) {
      const feeData = feesSnap.docs[0].data() as FeeRecord;
      const pdfBuffer = await renderToBuffer(
        React.createElement(ReceiptDocument, {
          receiptNo,
          date: feeData.paidAt || feeData.updatedAt || new Date().toISOString(),
          paymentMethod: feeData.paymentMethod || "cash",
          amount: feeData.amount,
          studentName: feeData.studentName || "Student",
          studentGrade: feeData.grade || "",
          description: `${feeData.className || "Class Fee"} - Monthly Tuition (${feeData.month})`,
          college: collegeInfo,
        }) as any
      );

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="receipt-${receiptNo}.pdf"`,
        },
      });
    }

    // 3. Search admission fee records
    const studentsSnap = await adminDb
      .collection("students")
      .where("admissionFee.receiptNo", "==", receiptNo)
      .limit(1)
      .get();

    if (!studentsSnap.empty) {
      const studentData = studentsSnap.docs[0].data() as Student;
      const admFee = studentData.admissionFee;

      const pdfBuffer = await renderToBuffer(
        React.createElement(ReceiptDocument, {
          receiptNo,
          date: admFee.paidDate || studentData.updatedAt || new Date().toISOString(),
          paymentMethod: admFee.method || "cash",
          amount: admFee.amount,
          studentName: studentData.name,
          studentGrade: studentData.gradesByYear?.[yearId] || "Grade 10",
          description: "One-Time College Admission Fee",
          college: collegeInfo,
        }) as any
      );

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="receipt-${receiptNo}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: `Receipt "${receiptNo}" not found.` }, { status: 404 });
  } catch (error: any) {
    console.error("GET /api/owner/fees/receipt/[receiptNo]/pdf error:", error);
    return NextResponse.json(
      { error: "Failed to generate receipt PDF: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
