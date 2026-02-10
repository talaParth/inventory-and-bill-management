import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { PurchaseBill } from '@/types';
import { formatDate } from '@/lib/billUtils';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  headerDetails: {
    textAlign: 'right',
  },
  vendorSection: {
    marginBottom: 25,
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e40af',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 3,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    color: '#fff',
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 8,
  },
  col1: { width: '40%' },
  col2: { width: '15%', textAlign: 'center' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  summaryBox: {
    width: '40%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#1e40af',
    fontSize: 14,
    color: '#1e40af',
  },
  paymentSection: {
    marginTop: 30,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
});

const formatPDFCurrency = (amount: number) => {
  return `Rs. ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

interface PurchaseBillPDFProps {
  bill: PurchaseBill;
}

export const PurchaseBillPDF: React.FC<PurchaseBillPDFProps> = ({ bill }) => {
  const totalReturnAmount = bill.returns?.reduce((s, r) => s + r.totalReturnValue, 0) || 0;
  const originalTotal = bill.total + totalReturnAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PURCHASE INVOICE</Text>
            <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
              Status: {bill.paymentStatus?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
          <View style={styles.headerDetails}>
            <Text style={{ fontWeight: 'bold' }}>Bill #: {bill.billNumber || 'N/A'}</Text>
            <Text>Date: {formatDate(bill.billDate || bill.createdAt)}</Text>
            {bill.dueDate && <Text>Due: {formatDate(bill.dueDate)}</Text>}
          </View>
        </View>

        <View style={styles.vendorSection}>
          <Text style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 5 }}>VENDOR DETAILS</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{bill.vendorName}</Text>
          {bill.vendorGstin && <Text style={{ marginTop: 2 }}>GSTIN: {bill.vendorGstin}</Text>}
        </View>

        <View style={styles.table}>
          <Text style={styles.sectionTitle}>BILL ITEMS</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Description</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Rate</Text>
            <Text style={styles.col4}>Tax</Text>
            <Text style={styles.col5}>Total</Text>
          </View>
          {bill.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity} {item.unit}</Text>
              <Text style={styles.col3}>{formatPDFCurrency(item.rate)}</Text>
              <Text style={styles.col4}>{item.gstRate}%</Text>
              <Text style={styles.col5}>{formatPDFCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        {bill.returns && bill.returns.length > 0 && (
          <View style={styles.table}>
            <Text style={styles.sectionTitle}>RETURNS</Text>
            <View style={[styles.tableHeader, { backgroundColor: '#f97316' }]}>
              <Text style={styles.col1}>Product / Reason</Text>
              <Text style={styles.col2}>Qty</Text>
              <Text style={styles.col3}>Date</Text>
              <Text style={styles.col5}>Value (incl. GST)</Text>
            </View>
            {bill.returns.map((ret, index) => (
              <React.Fragment key={index}>
                {ret.items.map((item, iIdx) => {
                  const itemValue = item.quantity * item.rate;
                  const itemGst = itemValue * (item.gstRate / 100);
                  const totalWithGst = itemValue + itemGst;
                  return (
                    <View key={`${index}-${iIdx}`} style={styles.tableRow}>
                      <Text style={styles.col1}>{item.description}</Text>
                      <Text style={styles.col2}>{item.quantity}</Text>
                      <Text style={styles.col3}>{formatDate(ret.returnDate)}</Text>
                      <Text style={styles.col5}>-{formatPDFCurrency(totalWithGst)}</Text>
                    </View>
                  );
                })}
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text>Subtotal:</Text>
              <Text>{formatPDFCurrency(bill.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Total Tax:</Text>
              <Text>{formatPDFCurrency(bill.totalTax)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Bill Total:</Text>
              <Text>{formatPDFCurrency(originalTotal)}</Text>
            </View>
            {totalReturnAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={{ color: '#f97316' }}>Returned (incl. GST):</Text>
                <Text style={{ color: '#f97316' }}>-{formatPDFCurrency(totalReturnAmount)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={{ fontWeight: 'bold' }}>Net Amount:</Text>
              <Text style={{ fontWeight: 'bold' }}>{formatPDFCurrency(bill.total)}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 10 }]}>
              <Text>Paid Amount:</Text>
              <Text style={{ color: '#059669', fontWeight: 'bold' }}>{formatPDFCurrency(bill.paidAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Balance Due:</Text>
              <Text style={{ color: bill.total - bill.paidAmount > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>
                {formatPDFCurrency(bill.total - bill.paidAmount)}
              </Text>
            </View>
          </View>
        </View>

        {bill.payments && bill.payments.length > 0 && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>PAYMENT HISTORY</Text>
            <View style={[styles.tableHeader, { backgroundColor: '#64748b' }]}>
              <Text style={{ width: '30%' }}>Date</Text>
              <Text style={{ width: '30%' }}>Method</Text>
              <Text style={{ width: '40%', textAlign: 'right' }}>Amount</Text>
            </View>
            {bill.payments.map((payment, index) => (
              <View key={index} style={styles.paymentRow}>
                <Text style={{ width: '30%' }}>{formatDate(payment.date)}</Text>
                <Text style={{ width: '30%' }}>{payment.method}</Text>
                <Text style={{ width: '40%', textAlign: 'right', fontWeight: 'bold' }}>
                  {formatPDFCurrency(payment.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          Shree Rudra Jewels - 9R NFC Invoice Management System
          {"\n"}This is a computer generated document.
        </Text>
      </Page>
    </Document>
  );
};
