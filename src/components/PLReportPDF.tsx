import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '../lib/billUtils';

// Register fonts if needed
// Font.register({ family: 'Helvetica', src: 'Helvetica' });

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f3f4f6',
    padding: 5,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  label: {
    color: '#4b5563',
  },
  value: {
    fontWeight: 'bold',
    color: '#111827',
  },
  profit: {
    color: '#059669',
    fontWeight: 'bold',
  },
  loss: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
});

interface PLReportProps {
  stats: any;
  company?: any;
  dateRange: { start: string; end: string };
}

export const PLReportPDF = ({ stats, company, dateRange }: PLReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{company?.name || 'Business'} - P&L Report</Text>
        <Text style={styles.subtitle}>
          Period: {dateRange.start ? formatDate(dateRange.start) : 'All Time'} to {dateRange.end ? formatDate(dateRange.end) : 'Present'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Income</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Sales Revenue (Paid)</Text>
          <Text style={styles.value}>{formatCurrency(stats.totalRevenue)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>GST Collected</Text>
          <Text style={styles.value}>{formatCurrency(stats.gstCollected)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses & COGS</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Cost of Goods Sold (COGS)</Text>
          <Text style={styles.value}>{formatCurrency(stats.totalCOGS)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Operational Expenses</Text>
          <Text style={styles.value}>{formatCurrency(stats.totalExpenses)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Deadstock Loss</Text>
          <Text style={styles.value}>{formatCurrency(stats.deadstockLoss)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>GST Paid on Purchases</Text>
          <Text style={styles.value}>{formatCurrency(stats.gstPaid)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profitability Analysis</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Gross Profit</Text>
          <Text style={[styles.value, stats.grossProfit >= 0 ? styles.profit : styles.loss]}>
            {formatCurrency(stats.grossProfit)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Net Profit</Text>
          <Text style={[styles.value, stats.profit >= 0 ? styles.profit : styles.loss]}>
            {formatCurrency(stats.profit)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Profit Margin</Text>
          <Text style={styles.value}>
            {stats.totalRevenue > 0 ? ((stats.profit / stats.totalRevenue) * 100).toFixed(2) : 0}%
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Taxation (GST)</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Net GST (Collected - Paid)</Text>
          <Text style={styles.value}>{formatCurrency(stats.netGst)}</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Generated on {new Date().toLocaleString()} | {company?.name}
      </Text>
    </Page>
  </Document>
);
