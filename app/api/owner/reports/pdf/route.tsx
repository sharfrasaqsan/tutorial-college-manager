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
import { formatColomboPattern } from "@/lib/dates";
import { formatLKR } from "@/lib/money";
import {
  getStudentPaymentsReport,
  getPendingFeesReport,
  getTeacherSalaryReport,
  getMonthSummaryReport,
  type StudentPaymentsReportData,
  type PendingFeesReportData,
  type TeacherSalaryReportData,
  type MonthSummaryReportData,
} from "@/lib/reports";
import type { CollegeProfile } from "@/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 45,
    paddingHorizontal: 36,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1C1F23",
    backgroundColor: "#FFFFFF",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    paddingBottom: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  collegeTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
    marginBottom: 2,
  },
  collegeSubtitle: {
    fontSize: 7,
    color: "#5F6670",
    marginBottom: 1,
  },
  reportMetaBlock: {
    textAlign: "right",
  },
  reportTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1C1F23",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  reportMonth: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
    marginBottom: 1,
  },
  reportGenerated: {
    fontSize: 7,
    color: "#5F6670",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#E4E1DA",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 7,
    color: "#5F6670",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    padding: 6,
    backgroundColor: "#FAF9F6",
  },
  summaryCardLabel: {
    fontSize: 6.5,
    color: "#5F6670",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  summaryCardValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1C1F23",
  },
  summaryCardValueAccent: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1F5C4D",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1C1F23",
    marginTop: 8,
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCol: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#5F6670",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E1DA",
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#FAF9F6",
  },
  tableTotalRow: {
    flexDirection: "row",
    backgroundColor: "#FAF9F6",
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  textRight: {
    textAlign: "right",
  },
  textCenter: {
    textAlign: "center",
  },
});

interface SharedReportHeaderProps {
  college: CollegeProfile;
  title: string;
  monthDisplay: string;
  generatedAt: string;
}

function SharedHeader({ college, title, monthDisplay, generatedAt }: SharedReportHeaderProps) {
  return (
    <View style={styles.header} fixed>
      <View>
        <Text style={styles.collegeTitle}>{college.name || "Tutorial College"}</Text>
        <Text style={styles.collegeSubtitle}>{college.address || "Colombo, Sri Lanka"}</Text>
        {college.phone ? <Text style={styles.collegeSubtitle}>Phone: {college.phone}</Text> : null}
      </View>
      <View style={styles.reportMetaBlock}>
        <Text style={styles.reportTitle}>{title}</Text>
        <Text style={styles.reportMonth}>{monthDisplay}</Text>
        <Text style={styles.reportGenerated}>Generated: {generatedAt}</Text>
      </View>
    </View>
  );
}

function SharedFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Confidential • College Administration Report (Asia/Colombo)</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// 1. Student Payments Report Component
function StudentPaymentsReportDoc({
  data,
  college,
}: {
  data: StudentPaymentsReportData;
  college: CollegeProfile;
}) {
  return (
    <Document title={`Report-Student-Payments-${data.month}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <SharedHeader
          college={college}
          title="Student Payments Report"
          monthDisplay={data.monthDisplay}
          generatedAt={data.generatedAt}
        />

        {/* Summary Card */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Payments Received</Text>
            <Text style={styles.summaryCardValue}>{data.totalPaidCount} students</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Tuition Collected</Text>
            <Text style={styles.summaryCardValueAccent}>{formatLKR(data.totalCollected)}</Text>
          </View>
        </View>

        {/* Classes & Students Tables */}
        {data.classes.map((cls) => (
          <View key={cls.classId} wrap={false} style={{ marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>
              {cls.className} ({cls.paidCount} paid • {formatLKR(cls.totalAmount)})
            </Text>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCol, { flex: 3 }]}>Student Name</Text>
                <Text style={[styles.tableHeaderCol, { flex: 1.5 }]}>Receipt #</Text>
                <Text style={[styles.tableHeaderCol, { flex: 1.2 }]}>Method</Text>
                <Text style={[styles.tableHeaderCol, { flex: 1.5 }]}>Date</Text>
                <Text style={[styles.tableHeaderCol, styles.textRight, { flex: 1.8 }]}>Amount (LKR)</Text>
              </View>

              {cls.payments.map((p) => (
                <View key={p.id} style={styles.tableRow}>
                  <Text style={[{ flex: 3 }, styles.bold]}>{p.studentName}</Text>
                  <Text style={[{ flex: 1.5, fontSize: 7 }]}>{p.receiptNo}</Text>
                  <Text style={[{ flex: 1.2, textTransform: "uppercase" }]}>{p.paymentMethod}</Text>
                  <Text style={[{ flex: 1.5, fontSize: 7 }]}>{p.paidAt.slice(0, 10)}</Text>
                  <Text style={[{ flex: 1.8 }, styles.textRight, styles.bold]}>{formatLKR(p.amount)}</Text>
                </View>
              ))}

              <View style={styles.tableTotalRow}>
                <Text style={[{ flex: 7.2 }, styles.bold, styles.textRight]}>Subtotal:</Text>
                <Text style={[{ flex: 1.8 }, styles.bold, styles.textRight, { color: "#1F5C4D" }]}>
                  {formatLKR(cls.totalAmount)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <SharedFooter />
      </Page>
    </Document>
  );
}

// 2. Pending Fees Report Component
function PendingFeesReportDoc({
  data,
  college,
}: {
  data: PendingFeesReportData;
  college: CollegeProfile;
}) {
  return (
    <Document title={`Report-Pending-Fees-${data.month}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <SharedHeader
          college={college}
          title="Pending Fees Report"
          monthDisplay={data.monthDisplay}
          generatedAt={data.generatedAt}
        />

        {/* KPI Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Students with Arrears</Text>
            <Text style={styles.summaryCardValue}>{data.totalStudentsPending}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Tuition Outstanding</Text>
            <Text style={styles.summaryCardValue}>{formatLKR(data.totalTuitionUnpaid)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Admission Outstanding</Text>
            <Text style={styles.summaryCardValue}>{formatLKR(data.totalAdmissionUnpaid)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Grand Total Pending</Text>
            <Text style={[styles.summaryCardValue, { color: "#A32A2A" }]}>
              {formatLKR(data.grandTotalPending)}
            </Text>
          </View>
        </View>

        {/* Unpaid Students Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCol, { flex: 2.5 }]}>Student</Text>
            <Text style={[styles.tableHeaderCol, { flex: 1.2 }]}>Grade</Text>
            <Text style={[styles.tableHeaderCol, { flex: 2.2 }]}>Guardian & Phone</Text>
            <Text style={[styles.tableHeaderCol, { flex: 2.1 }]}>Unpaid Classes</Text>
            <Text style={[styles.tableHeaderCol, styles.textRight, { flex: 1.2 }]}>Admission</Text>
            <Text style={[styles.tableHeaderCol, styles.textRight, { flex: 1.6 }]}>Total Due</Text>
          </View>

          {data.students.map((s, idx) => (
            <View key={s.studentId} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[{ flex: 2.5 }, styles.bold]}>{s.studentName}</Text>
              <Text style={{ flex: 1.2 }}>{s.grade}</Text>
              <View style={{ flex: 2.2 }}>
                <Text style={{ fontSize: 7, color: "#1C1F23" }}>{s.guardianName}</Text>
                <Text style={{ fontSize: 7, color: "#1F5C4D", fontFamily: "Helvetica-Bold" }}>
                  {s.guardianPhone}
                </Text>
              </View>
              <Text style={[{ flex: 2.1, fontSize: 7, color: "#5F6670" }]}>
                {s.classesPending.map((c) => c.className).join(", ") || "Admission Only"}
              </Text>
              <Text style={[{ flex: 1.2 }, styles.textRight]}>
                {s.admissionFeePending > 0 ? formatLKR(s.admissionFeePending) : "-"}
              </Text>
              <Text style={[{ flex: 1.6 }, styles.textRight, styles.bold, { color: "#A32A2A" }]}>
                {formatLKR(s.totalPending)}
              </Text>
            </View>
          ))}

          <View style={styles.tableTotalRow}>
            <Text style={[{ flex: 8 }, styles.bold, styles.textRight]}>Grand Total Outstanding:</Text>
            <Text style={[{ flex: 2.8 }, styles.bold, styles.textRight, { color: "#A32A2A", fontSize: 9 }]}>
              {formatLKR(data.grandTotalPending)}
            </Text>
          </View>
        </View>

        <SharedFooter />
      </Page>
    </Document>
  );
}

// 3. Teacher Salary Report Component
function TeacherSalaryReportDoc({
  data,
  college,
}: {
  data: TeacherSalaryReportData;
  college: CollegeProfile;
}) {
  return (
    <Document title={`Report-Teacher-Salary-${data.month}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <SharedHeader
          college={college}
          title="Teacher Salary Report"
          monthDisplay={data.monthDisplay}
          generatedAt={data.generatedAt}
        />

        {/* KPI Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total Salary Allocation</Text>
            <Text style={styles.summaryCardValue}>{formatLKR(data.grandTotalSalary)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Ready for Payout</Text>
            <Text style={styles.summaryCardValueAccent}>{formatLKR(data.totalReadyAmount)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Paid Payouts</Text>
            <Text style={styles.summaryCardValue}>{formatLKR(data.totalPaidAmount)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>On Hold</Text>
            <Text style={[styles.summaryCardValue, { color: "#9A5B00" }]}>
              {formatLKR(data.totalOnHoldAmount)}
            </Text>
          </View>
        </View>

        {/* Teachers Breakdown */}
        {data.teachers.map((t) => (
          <View key={t.teacherId} wrap={false} style={{ marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>
              {t.teacherName} (Total: {formatLKR(t.totalAmount)} • Paid: {formatLKR(t.paidAmount)} • Ready: {formatLKR(t.readyAmount)})
            </Text>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCol, { flex: 2.8 }]}>Class</Text>
                <Text style={[styles.tableHeaderCol, styles.textCenter, { flex: 1.5 }]}>Sessions</Text>
                <Text style={[styles.tableHeaderCol, styles.textCenter, { flex: 1.2 }]}>Enrolled</Text>
                <Text style={[styles.tableHeaderCol, styles.textCenter, { flex: 1.2 }]}>Status</Text>
                <Text style={[styles.tableHeaderCol, { flex: 1.8 }]}>Invoice / Deposit</Text>
                <Text style={[styles.tableHeaderCol, styles.textRight, { flex: 1.7 }]}>Amount (LKR)</Text>
              </View>

              {t.classes.map((cls) => (
                <View key={cls.classId} style={styles.tableRow}>
                  <Text style={[{ flex: 2.8 }, styles.bold]}>{cls.className}</Text>
                  <Text style={[{ flex: 1.5 }, styles.textCenter]}>
                    {cls.heldSessions} of {cls.requiredSessions}
                  </Text>
                  <Text style={[{ flex: 1.2 }, styles.textCenter]}>{cls.studentCount}</Text>
                  <Text
                    style={[
                      { flex: 1.2, textTransform: "uppercase", fontSize: 6.5 },
                      styles.textCenter,
                      styles.bold,
                      cls.status === "paid" || cls.status === "ready"
                        ? { color: "#1F5C4D" }
                        : { color: "#9A5B00" },
                    ]}
                  >
                    {cls.status === "onHold" ? "On Hold" : cls.status}
                  </Text>
                  <Text style={[{ flex: 1.8, fontSize: 6.5, color: "#5F6670" }]}>
                    {cls.invoiceNo ? `${cls.invoiceNo} (${cls.depositDate || "Paid"})` : "-"}
                  </Text>
                  <Text style={[{ flex: 1.7 }, styles.textRight, styles.bold]}>{formatLKR(cls.amount)}</Text>
                </View>
              ))}

              <View style={styles.tableTotalRow}>
                <Text style={[{ flex: 8.5 }, styles.bold, styles.textRight]}>Teacher Total:</Text>
                <Text style={[{ flex: 1.7 }, styles.bold, styles.textRight, { color: "#1F5C4D" }]}>
                  {formatLKR(t.totalAmount)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <SharedFooter />
      </Page>
    </Document>
  );
}

// 4. Month Summary Report Component
function MonthSummaryReportDoc({
  data,
  college,
}: {
  data: MonthSummaryReportData;
  college: CollegeProfile;
}) {
  const fin = data.financials;

  return (
    <Document title={`Report-Month-Summary-${data.month}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <SharedHeader
          college={college}
          title="Monthly Financial & Operations Summary"
          monthDisplay={data.monthDisplay}
          generatedAt={data.generatedAt}
        />

        {/* Executive Metrics Overview */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Fees Collected</Text>
            <Text style={styles.summaryCardValueAccent}>{formatLKR(fin.totalCollected)}</Text>
            <Text style={{ fontSize: 6.5, color: "#5F6670", marginTop: 1 }}>
              {fin.collectionRate}% of expected
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Fees Pending</Text>
            <Text style={[styles.summaryCardValue, { color: "#A32A2A" }]}>{formatLKR(fin.totalUnpaid)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Teacher Payouts</Text>
            <Text style={styles.summaryCardValue}>{formatLKR(fin.totalTeacherShare)}</Text>
            <Text style={{ fontSize: 6.5, color: "#5F6670", marginTop: 1 }}>
              Paid: {formatLKR(fin.totalSalaryPaid)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Owner Share</Text>
            <Text style={[styles.summaryCardValueAccent, { fontSize: 11 }]}>
              {formatLKR(fin.ownerShare)}
            </Text>
            <Text style={{ fontSize: 6.5, color: "#5F6670", marginTop: 1 }}>
              Collected fees - teacher share
            </Text>
          </View>
        </View>

        {/* Classes Operations Table: Sessions Held vs Required */}
        <Text style={styles.sectionTitle}>Academic Operations & Class Performance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCol, { flex: 2.8 }]}>Class</Text>
            <Text style={[styles.tableHeaderCol, { flex: 2.2 }]}>Teacher</Text>
            <Text style={[styles.tableHeaderCol, styles.textCenter, { flex: 1 }]}>Students</Text>
            <Text style={[styles.tableHeaderCol, styles.textCenter, { flex: 1.5 }]}>Sessions</Text>
            <Text style={[styles.tableHeaderCol, styles.textCenter, { flex: 1.2 }]}>Target %</Text>
            <Text style={[styles.tableHeaderCol, styles.textRight, { flex: 1.6 }]}>Fees Expected</Text>
            <Text style={[styles.tableHeaderCol, styles.textRight, { flex: 1.6 }]}>Teacher Share</Text>
          </View>

          {data.classesPerformance.map((c, idx) => (
            <View key={c.classId} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <View style={{ flex: 2.8 }}>
                <Text style={styles.bold}>{c.className}</Text>
                <Text style={{ fontSize: 6.5, color: "#5F6670" }}>{c.grade}</Text>
              </View>
              <Text style={{ flex: 2.2 }}>{c.teacherName}</Text>
              <Text style={[{ flex: 1 }, styles.textCenter]}>{c.studentCount}</Text>
              <Text style={[{ flex: 1.5 }, styles.textCenter]}>
                {c.heldSessions} / {c.requiredSessions}
              </Text>
              <Text
                style={[
                  { flex: 1.2 },
                  styles.textCenter,
                  styles.bold,
                  c.completionRate >= 100 ? { color: "#1F5C4D" } : { color: "#9A5B00" },
                ]}
              >
                {c.completionRate}%
              </Text>
              <Text style={[{ flex: 1.6 }, styles.textRight]}>{formatLKR(c.totalFeesExpected)}</Text>
              <Text style={[{ flex: 1.6 }, styles.textRight, styles.bold]}>{formatLKR(c.totalTeacherShare)}</Text>
            </View>
          ))}
        </View>

        <SharedFooter />
      </Page>
    </Document>
  );
}

/**
 * GET /api/owner/reports/pdf
 * Renders and streams official report PDFs using the shared template.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");
    const month = searchParams.get("month") || currentMonth;
    const type = searchParams.get("type") || "month-summary";

    // 1. Fetch College profile
    const collegeDoc = await adminDb.collection("settings").doc("college").get();
    const collegeData = (collegeDoc.exists ? collegeDoc.data() : null) as CollegeProfile | null;
    const collegeInfo: CollegeProfile = {
      name: collegeData?.name || "Tutorial College",
      address: collegeData?.address || "Colombo, Sri Lanka",
      phone: collegeData?.phone || "",
      email: collegeData?.email || "",
      aboutText: collegeData?.aboutText || "",
      openingHours: collegeData?.openingHours || "",
      updatedAt: collegeData?.updatedAt || new Date().toISOString(),
      logoUrl: collegeData?.logoUrl,
    };

    let documentElement: React.ReactElement;
    let fileName = `Report-${type}-${month}.pdf`;

    if (type === "student-payments") {
      const data = await getStudentPaymentsReport(yearId, month);
      documentElement = React.createElement(StudentPaymentsReportDoc, {
        data,
        college: collegeInfo,
      });
      fileName = `Student-Payments-${month}.pdf`;
    } else if (type === "pending-fees") {
      const data = await getPendingFeesReport(yearId, month);
      documentElement = React.createElement(PendingFeesReportDoc, {
        data,
        college: collegeInfo,
      });
      fileName = `Pending-Fees-${month}.pdf`;
    } else if (type === "teacher-salary") {
      const data = await getTeacherSalaryReport(yearId, month);
      documentElement = React.createElement(TeacherSalaryReportDoc, {
        data,
        college: collegeInfo,
      });
      fileName = `Teacher-Salary-${month}.pdf`;
    } else {
      const data = await getMonthSummaryReport(yearId, month);
      documentElement = React.createElement(MonthSummaryReportDoc, {
        data,
        college: collegeInfo,
      });
      fileName = `Month-Summary-${month}.pdf`;
    }

    const pdfBuffer = await renderToBuffer(documentElement as any);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/owner/reports/pdf error:", error);
    return NextResponse.json(
      { error: "Failed to generate report PDF: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
