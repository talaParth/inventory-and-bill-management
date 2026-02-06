import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { Product } from '@/types';
import { formatCurrency, formatDate } from '@/lib/billUtils';

// Register a standard font for better compatibility
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginTop: 10,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eee',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    width: '16.6%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eee',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#f9f9f9',
    padding: 5,
  },
  tableCol: {
    width: '16.6%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#eee',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableCell: {
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
});

interface InventoryPDFProps {
  products: Product[];
  companyProfile: any;
  currentAveragePrices: Record<string, number>;
  stockValues: Record<string, number>;
}

export const InventoryPDF = ({ products, companyProfile, currentAveragePrices, stockValues }: InventoryPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{companyProfile?.name || 'Inventory Report'}</Text>
        <Text style={styles.subtitle}>Generated on: {formatDate(new Date().toISOString())}</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Name</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>HSN</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Stock</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Purchase</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Selling</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Value</Text></View>
        </View>

        {products.map((p) => (
          <View style={styles.tableRow} key={p.id}>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{p.name}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{p.hsnCode}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{p.stock} {p.unit}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{formatCurrency(currentAveragePrices[p.id] || p.purchasePrice || 0)}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{formatCurrency(p.sellingPrice || p.price || 0)}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{formatCurrency(stockValues[p.id] || 0)}</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        {companyProfile?.address} | {companyProfile?.phone} | {companyProfile?.email}
      </Text>
    </Page>
  </Document>
);
