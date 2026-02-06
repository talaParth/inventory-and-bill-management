import { getBills, getProducts, getClients, getPurchaseBills, getExpenses, getBillReturns, getDeadstock, getCompanyProfile } from "./storage";

export const getBusinessDataForAI = async () => {
  try {
    const [
      bills,
      products,
      clients,
      purchaseBills,
      expenses,
      returns,
      deadstock,
      company
    ] = await Promise.all([
      getBills(),
      getProducts(),
      getClients(),
      getPurchaseBills(),
      getExpenses(),
      getBillReturns(),
      getDeadstock(),
      getCompanyProfile()
    ]);

    // Format data for AI consumption - reducing size for context window
    const summary = {
      company: company ? { name: company.name, businessType: company.businessType } : "Not set",
      stats: {
        totalSales: bills.reduce((sum, b) => sum + b.total, 0),
        totalCollected: bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0),
        totalPurchases: purchaseBills.reduce((sum, b) => sum + b.total, 0),
        totalExpenses: expenses.reduce((sum, b) => sum + b.amount, 0),
        inventoryValue: products.reduce((sum, p) => sum + (p.stock * (p.purchasePrice || 0)), 0),
        totalReturns: returns.length,
        deadstockCount: deadstock.length
      },
      topClients: clients.slice(0, 5).map(c => ({ name: c.name, city: c.city })),
      recentBills: bills.slice(0, 10).map(b => ({ 
        no: b.billNumber, 
        client: b.client.name, 
        total: b.total, 
        status: b.paymentStatus 
      })),
      recentExpenses: expenses.slice(0, 10).map(e => ({ 
        cat: e.category, 
        amt: e.amount, 
        desc: e.description 
      })),
      clientwiseSales: clients.map(c => {
        const clientBills = bills.filter(b => b.client.id === c.id);
        return {
          name: c.name,
          totalSales: clientBills.reduce((sum, b) => sum + b.total, 0),
          pending: clientBills.reduce((sum, b) => sum + (b.total - (b.paidAmount || 0)), 0)
        };
      }).sort((a, b) => b.totalSales - a.totalSales).slice(0, 10)
    };

    return summary;
  } catch (error) {
    console.error("Error collecting business data:", error);
    throw error;
  }
};
