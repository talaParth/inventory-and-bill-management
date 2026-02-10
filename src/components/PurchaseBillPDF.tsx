import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { PurchaseBill, PurchaseReturn } from '@/types';
import { formatCurrency, formatDate } from '@/lib/billUtils';

// Register fonts if needed, or use standard ones
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    backgroundColor: '#f9f9f9',
    padding: 3,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  col1: { width: '40%' },
  col2: { width: '15%', textAlign: 'center' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  summary: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '40%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-space-between',
    paddingVertical: 2,
  },
  total: {
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 5,
  },
  badge: {
    fontSize: 8,
    padding: 2,
    borderRadius: 3,
    backgroundColor: '#eee',
    marginLeft: 5,
  }
});

interface PurchaseBillPDFProps {
  bill: PurchaseBill;
}

export const PurchaseBillPDF: React.FC<PurchaseBillPDFProps> = ({ bill }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Purchase Bill Details</Text>
          <Text>Vendor: {bill.vendorName}</Text>
          <Text>Bill #: {bill.billNumber || 'N/A'}</Text>
          <Text>Date: {formatDate(bill.billDate || bill.createdAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Items</Text>
          <View style={[styles.row, styles.tableHeader]}>
            <Text style={styles.col1}>Description</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Rate</Text>
            <Text style={styles.col4}>Tax</Text>
            <Text style={styles.col5}>Total</Text>
          </View>
          {bill.items.map((item, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity} {item.unit}</Text>
              <Text style={styles.col3}>{formatCurrency(item.rate)}</Text>
              <Text style={styles.col4}>{item.gstRate}%</Text>
              <Text style={styles.col5}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        {bill.returns && bill.returns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Purchase Returns</Text>
            <View style={[styles.row, styles.tableHeader]}>
              <Text style={styles.col1}>Product / Reason</Text>
              <Text style={styles.col2}>Qty</Text>
              <Text style={styles.col3}>Date</Text>
              <Text style={styles.col5}>Value</Text>
            </View>
            {bill.returns.map((ret, index) => (
              <React.Fragment key={index}>
                {ret.items.map((item, iIdx) => (
                  <View key={`${index}-${iIdx}`} style={styles.row}>
                    <Text style={styles.col1}>{item.description}</Text>
                    <Text style={styles.col2}>{item.quantity}</Text>
                    <Text style={styles.col3}>{formatDate(ret.returnDate)}</Text>
                    <Text style={styles.col5}>{formatCurrency(item.totalValue)}</Text>
                  </View>
                ))}
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(bill.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Tax:</Text>
            <Text>{formatCurrency(bill.totalTax)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Original Total:</Text>
            <Text>{formatCurrency(bill.total + (bill.returns?.reduce((s, r) => s + r.totalReturnValue, 0) || 0))}</Text>
          </View>
          {bill.returns && bill.returns.length > 0 && (
            <View style={styles.summaryRow}>
              <Text>Total Returned:</Text>
              <Text>- {formatCurrency(bill.returns.reduce((s, r) => s + r.totalReturnValue, 0))}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.total]}>
            <Text>Net Amount:</Text>
            <Text>{formatCurrency(bill.total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Paid Amount:</Text>
            <Text>{formatCurrency(bill.paidAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Balance Due:</Text>
            <Text>{formatCurrency(bill.total - bill.paidAmount)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};