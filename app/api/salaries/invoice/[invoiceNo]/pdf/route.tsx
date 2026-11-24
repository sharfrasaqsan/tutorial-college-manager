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
import type { CollegeProfile, Invoice, SalaryClassSummary } from "@/types";

interface RouteParams {
  params: Promise<{ invoiceNo: string }>;
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1C1F23",
    backgroundColor: "#FFFFFF",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    paddingBottom: 12,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  collegeTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
    marginBottom: 3,
  },
  collegeSubtitle: {
    fontSize: 8,
    color: "#5F6670",
    marginBottom: 2,
  },
  invoiceTitleBlock: {
    textAlign: "right",
  },
  invoiceBadge: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1C1F23",
    marginBottom: 3,
  },
  invoiceNoText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
  },
  metaGrid: {
    flexDirection: "row",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#FAF9F6",
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: "#5F6670",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  table: {
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    padding: 8,
  },
  tableHeaderCol: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#5F6670",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
  },
  tableFooter: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    padding: 10,
    alignItems: "center",
  },
  colClass: {
    flex: 3,
  },
  colSessions: {
    flex: 1.5,
    textAlign: "center",
  },
  colStudents: {
    flex: 1.2,
    textAlign: "center",
  },
  colAmount: {
    flex: 1.8,
    textAlign: "right",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  totalLabel: {
    flex: 5.7,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  totalAmountText: {
    flex: 1.8,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
  },
  paymentNotes: {
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    padding: 8,
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1C1F23",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    color: "#5F6670",
  },
  footerNotice: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 7,
    color: "#5F6670",
  },
});

interface InvoiceDocProps {
  invoice: Invoice;
  college: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
  };
}

function InvoiceDocument({ invoice, college }: InvoiceDocProps) {
  const formattedTotal = formatLKR(invoice.totalAmount);
  const formattedDepositDate = invoice.depositDate
    ? new Date(invoice.depositDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";
  const formattedIssueDate = new Date(invoice.issuedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Document title={`Invoice-${invoice.invoiceNo}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.collegeTitle}>{college.name}</Text>
            <Text style={styles.collegeSubtitle}>{college.address}</Text>
            {college.phone ? <Text style={styles.collegeSubtitle}>Phone: {college.phone}</Text> : null}
            {college.email ? <Text style={styles.collegeSubtitle}>Email: {college.email}</Text> : null}
          </View>
          <View style={styles.invoiceTitleBlock}>
            <Text style={styles.invoiceBadge}>TEACHER SALARY INVOICE</Text>
            <Text style={styles.invoiceNoText}>{invoice.invoiceNo}</Text>
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Teacher</Text>
            <Text style={styles.metaValue}>{invoice.teacherName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Month</Text>
            <Text style={styles.metaValue}>{invoice.month}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Deposit Date</Text>
            <Text style={styles.metaValue}>{formattedDepositDate}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Method</Text>
            <Text style={styles.metaValue}>{invoice.paymentMethod?.toUpperCase() || "BANK"}</Text>
          </View>
        </View>

        {/* Classes Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCol, styles.colClass]}>Class</Text>
            <Text style={[styles.tableHeaderCol, styles.colSessions]}>Sessions Held</Text>
            <Text style={[styles.tableHeaderCol, styles.colStudents]}>Enrolled</Text>
            <Text style={[styles.tableHeaderCol, styles.colAmount]}>Amount (LKR)</Text>
          </View>

          {invoice.classes.map((cls, idx) => (
            <View key={cls.classId || idx} style={styles.tableRow}>
              <View style={styles.colClass}>
                <Text style={styles.bold}>{cls.className}</Text>
                <Text style={{ fontSize: 7, color: "#5F6670" }}>{cls.grade} - {cls.subject}</Text>
              </View>
              <Text style={styles.colSessions}>
                {cls.sessionsHeld} of {cls.sessionsRequired}
              </Text>
              <Text style={styles.colStudents}>{cls.studentCount}</Text>
              <Text style={[styles.colAmount, styles.bold]}>{formatLKR(cls.amount)}</Text>
            </View>
          ))}

          <View style={styles.tableFooter}>
            <Text style={styles.totalLabel}>Total Payout:</Text>
            <Text style={styles.totalAmountText}>{formattedTotal}</Text>
          </View>
        </View>

        {/* Payment Confirmation Notes */}
        <View style={styles.paymentNotes}>
          <Text style={styles.notesLabel}>Payment Status: PAID</Text>
          <Text style={styles.notesText}>
            Deposit processed via {invoice.paymentMethod?.toUpperCase() || "BANK"} on {formattedDepositDate}.
            Generated on {formattedIssueDate}.
          </Text>
        </View>

        <Text style={styles.footerNotice}>
          This is an official computer-generated tutorial college salary payment invoice. No physical signature required.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * GET /api/salaries/invoice/[invoiceNo]/pdf
 * Renders and streams the teacher salary invoice PDF.
 * Authorized for owner, and for the teacher who owns this invoice.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner", "teacher"]);
  if (errorResponse) return errorResponse;

  const { invoiceNo } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    // 1. Fetch invoice document
    const invoiceDoc = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("invoices")
      .doc(invoiceNo)
      .get();

    if (!invoiceDoc.exists) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const invoiceData = invoiceDoc.data() as Invoice;

    // 2. Authorization check: if user is teacher, ensure they own this invoice
    if (user?.role === "teacher" && invoiceData.teacherId !== user.uid) {
      return NextResponse.json(
        { error: "Access denied. You can only view invoices issued to you." },
        { status: 403 }
      );
    }

    // 3. Fetch college profile
    const collegeDoc = await adminDb.collection("settings").doc("college").get();
    const collegeData = (collegeDoc.exists ? collegeDoc.data() : null) as CollegeProfile | null;

    const collegeInfo = {
      name: collegeData?.name || "Tutorial College",
      address: collegeData?.address || "Colombo, Sri Lanka",
      phone: collegeData?.phone || "",
      email: collegeData?.email || "",
    };

    // 4. Render PDF buffer
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoiceDocument, {
        invoice: invoiceData,
        college: collegeInfo,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Invoice-${invoiceNo}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("GET invoice PDF error:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice PDF: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
