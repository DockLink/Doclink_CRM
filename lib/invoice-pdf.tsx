import React from "react";
import fs from "fs";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Polygon,
  Line,
} from "@react-pdf/renderer";
import { INVOICE_CORNER } from "@/components/InvoiceCornerHeader";
import { formatMoney, toNumber } from "@/lib/invoice-format";

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  discountAmount: string;
  discountPercent: string;
  total: string;
  billToName: string | null;
  billToCompany: string | null;
  billToLine1: string | null;
  billToLine2: string | null;
  billToCity: string | null;
  billToPostal: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  paymentAccounts?: Array<{ accountType: string; bankName: string; accountName: string; accountNumber: string }>;
  termsAndConditions: string | null;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  lineItems: Array<{
    description: string;
    qty: number;
    unitPrice: string;
    total: string;
  }>;
};

const YELLOW = "#FCD144";
const BLUE = "#2B65B5";
const INK = "#1A1A1A";
const MUTED = "#4B5563";
const LOGO_SRC = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public/branding/doclink-logo.jpg"))
  .toString("base64")}`;

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  corner: {
    position: "absolute",
    top: 0,
    right: 0,
    width: INVOICE_CORNER.sizePx,
    height: INVOICE_CORNER.sizePx,
  },
  logo: {
    width: 100,
    height: 100,
    objectFit: "contain",
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  invoiceTitle: {
    fontSize: 42,
    fontFamily: "Helvetica-Bold",
    color: INK,
    letterSpacing: 1,
    marginTop: -4,
  },
  metaBlock: {
    alignItems: "flex-end",
    paddingTop: 6,
  },
  metaLine: {
    fontSize: 10,
    color: BLUE,
    marginBottom: 4,
    textAlign: "right",
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 32,
  },
  col: {
    flex: 1,
  },
  sectionRule: {
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    marginBottom: 8,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginBottom: 6,
  },
  line: {
    marginBottom: 2,
    lineHeight: 1.45,
    fontSize: 10,
    color: INK,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: YELLOW,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: INK,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  colDesc: { flex: 3.2 },
  colQty: { width: 42, textAlign: "right" },
  colPrice: { width: 95, textAlign: "right" },
  colTotal: { width: 95, textAlign: "right" },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  subtotalLabel: {
    fontSize: 10,
    color: INK,
  },
  subtotalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  grandTotalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: YELLOW,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  terms: {
    marginTop: 28,
  },
  termsTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginBottom: 10,
    textDecoration: "underline",
  },
  termsItem: {
    flexDirection: "row",
    marginBottom: 7,
    paddingRight: 8,
  },
  termsBullet: {
    width: 12,
    fontSize: 10,
    color: INK,
  },
  termsBody: {
    flex: 1,
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: YELLOW,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 40,
  },
  footerText: {
    fontSize: 9,
    color: INK,
  },
});

function formatDisplayDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function InvoiceCornerHeaderPdf() {
  const { band, triangle, line, viewBox, bandPoints, trianglePoints, lineCoords, sizePx } =
    INVOICE_CORNER;
  return (
    <View style={styles.corner}>
      <Svg viewBox={viewBox} width={sizePx} height={sizePx}>
        <Polygon points={bandPoints} fill={band} />
        <Polygon points={trianglePoints} fill={triangle} />
        <Line
          x1={lineCoords.x1}
          y1={lineCoords.y1}
          x2={lineCoords.x2}
          y2={lineCoords.y2}
          stroke={line}
          strokeWidth={lineCoords.strokeWidth}
        />
      </Svg>
    </View>
  );
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const cityLine = [data.billToCity, data.billToPostal].filter(Boolean).join(" ");
  const terms = (data.termsAndConditions ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const showDiscount = toNumber(data.discountAmount) > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <InvoiceCornerHeaderPdf />

        <Image src={LOGO_SRC} style={styles.logo} />

        <View style={styles.titleRow}>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Invoice No: {data.invoiceNumber}</Text>
            <Text style={styles.metaLine}>Invoice Date: {formatDisplayDate(data.invoiceDate)}</Text>
            <Text style={styles.metaLine}>Due Date: {formatDisplayDate(data.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <View style={styles.sectionRule}>
              <Text style={styles.sectionTitle}>Bill To:</Text>
            </View>
            {data.billToName ? <Text style={styles.line}>{data.billToName}</Text> : null}
            {data.billToCompany ? <Text style={styles.line}>{data.billToCompany}</Text> : null}
            {data.billToLine1 ? <Text style={styles.line}>{data.billToLine1}</Text> : null}
            {data.billToLine2 ? <Text style={styles.line}>{data.billToLine2}</Text> : null}
            {cityLine ? <Text style={styles.line}>{cityLine}</Text> : null}
          </View>
          <View style={styles.col}>
            <View style={styles.sectionRule}>
              <Text style={styles.sectionTitle}>Payment information:</Text>
            </View>
            {data.paymentAccounts?.length ? data.paymentAccounts.map((account) => (
              <View key={account.accountType}>
                <Text style={styles.line}>Bank: {account.bankName}</Text>
                {account.accountName ? <Text style={styles.line}>Account Name: {account.accountName}</Text> : null}
                <Text style={styles.line}>Account No: {account.accountNumber}</Text>
              </View>
            )) : (
              <>
                {data.bankName ? <Text style={styles.line}>Bank: {data.bankName}</Text> : null}
                {data.accountName ? <Text style={styles.line}>Account Name: {data.accountName}</Text> : null}
                {data.accountNumber ? <Text style={styles.line}>Account No: {data.accountNumber}</Text> : null}
              </>
            )}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.tableHeaderText]}>DESCRIPTION</Text>
          <Text style={[styles.colQty, styles.tableHeaderText]}>QTY</Text>
          <Text style={[styles.colPrice, styles.tableHeaderText]}>UNIT PRICE</Text>
          <Text style={[styles.colTotal, styles.tableHeaderText]}>TOTAL</Text>
        </View>
        {data.lineItems.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colPrice}>{formatMoney(item.unitPrice, data.currency)}</Text>
            <Text style={styles.colTotal}>{formatMoney(item.total, data.currency)}</Text>
          </View>
        ))}

        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal:</Text>
          <Text style={styles.subtotalValue}>{formatMoney(data.subtotal, data.currency)}</Text>
        </View>
        {showDiscount ? (
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Discount ({data.discountPercent}%):</Text>
            <Text style={styles.subtotalValue}>-{formatMoney(data.discountAmount, data.currency)}</Text>
          </View>
        ) : null}

        <View style={styles.grandTotalBar}>
          <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.grandTotalValue}>{formatMoney(data.total, data.currency)}</Text>
        </View>

        {terms.length > 0 ? (
          <View style={styles.terms}>
            <Text style={styles.termsTitle}>TERMS AND CONDITIONS</Text>
            {terms.map((line, index) => (
              <View key={index} style={styles.termsItem}>
                <Text style={styles.termsBullet}>•</Text>
                <Text style={styles.termsBody}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{data.companyPhone}</Text>
          <Text style={styles.footerText}>{data.companyWebsite}</Text>
          <Text style={styles.footerText}>{data.companyEmail}</Text>
        </View>
      </Page>
    </Document>
  );
}
