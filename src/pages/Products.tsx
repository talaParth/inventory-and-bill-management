
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getProducts,
  saveProduct,
  deleteProduct,
  getCompanyProfile,
  addStockToProduct,
  getProductTransactions,
  getInventoryTransactions,
  getBills,
  getBillReturns,
} from "@/lib/storage";
import { Product } from "@/types";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  History,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Percent,
  Calculator,
  PlusCircle,
  Search,
  Download,
  FileSpreadsheet,
  FileText as FilePdf,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ProductHistory } from "@/components/ProductHistory";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  calculateSellingPriceFromCommission,
  formatCurrency,
  roundToTwoDecimals,
} from "@/lib/billUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { format } from 'date-fns';
import { ProductsPDF } from '@/components/ProductsPDF';

export default function Products() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [addingStock, setAddingStock] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [stockFormData, setStockFormData] = useState({
    quantity: "",
    purchasePrice: "",
  });
  const [averagePrices, setAveragePrices] = useState<Record<string, number>>(
    {}
  );
  const [currentAveragePrices, setCurrentAveragePrices] = useState<
    Record<string, number>
  >({});
  const [stockValues, setStockValues] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [avgPriceFilter, setAvgPriceFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    hsnCode: "",
    gstRate: "",
    unit: "kg",
    price: "",
    purchasePrice: "",
    sellingPrice: "",
    stock: "",
    whereToBuy: "",
    weight: "",
  });
  const [addInitialStock, setAddInitialStock] = useState(false);
  const [initialStockData, setInitialStockData] = useState({
    quantity: "",
    purchasePrice: "",
  });

  useEffect(() => {
    loadProducts();
    loadCompanyProfile();
  }, []);

  useEffect(() => {
    if (products.length > 0) {
      loadAveragePrices();
    }
  }, [products, avgPriceFilter]);

  const loadAveragePrices = async () => {
    const prices: Record<string, number> = {};
    const currentPrices: Record<string, number> = {};
    const stockValues: Record<string, number> = {};

    const now = new Date();

    for (const product of products) {
      // Get all data needed for calculations
      const [bills, transactions] = await Promise.all([
        getBills(),
        getProductTransactions(product.id),
      ]);

      if (transactions && transactions.length > 0) {
        // Sort transactions by date descending to handle "last X bills"
        let filteredTransactions = [...transactions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Apply time/count filter
        if (avgPriceFilter === "last3") {
          filteredTransactions = filteredTransactions.slice(0, 3);
        } else if (avgPriceFilter === "last5") {
          filteredTransactions = filteredTransactions.slice(0, 5);
        } else if (avgPriceFilter === "1month") {
          const oneMonthAgo = new Date(now);
          oneMonthAgo.setMonth(now.getMonth() - 1);
          filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= oneMonthAgo);
        } else if (avgPriceFilter === "3month") {
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= threeMonthsAgo);
        } else if (avgPriceFilter === "6month") {
          const sixMonthsAgo = new Date(now);
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= sixMonthsAgo);
        }

        // Calculate total purchase value and quantity
        const totalPurchaseValue = filteredTransactions.reduce(
          (sum, t) => sum + t.quantity * (t.purchasePrice || 0),
          0
        );
        const totalPurchaseQuantity = filteredTransactions.reduce(
          (sum, t) => sum + t.quantity,
          0
        );

        // Overall weighted average purchase price for filtered period
        const filteredAvgPurchasePrice =
          totalPurchaseQuantity > 0
            ? totalPurchaseValue / totalPurchaseQuantity
            : product.purchasePrice || 0;

        prices[product.id] = filteredAvgPurchasePrice;

        // Current Average Price (Avg Buy) - this part should probably stay as product latest price or global avg
        // but user specifically asked for "Avg Purchase Price" calculation filter
        currentPrices[product.id] = filteredAvgPurchasePrice;
        stockValues[product.id] = product.stock * filteredAvgPurchasePrice;
      } else {
        // No purchase history, use product's purchase price
        prices[product.id] = product.purchasePrice || 0;
        currentPrices[product.id] = product.purchasePrice || 0;
        stockValues[product.id] = product.stock * (product.purchasePrice || 0);
      }
    }

    setAveragePrices(prices);
    setCurrentAveragePrices(currentPrices);
    setStockValues(stockValues);
  };

  const loadCompanyProfile = async () => {
    const profile = await getCompanyProfile();
    setCompanyProfile(profile);
    if (profile?.defaultUnit) {
      setFormData((prev) => ({
        ...prev,
        unit: profile.defaultUnit || prev.unit,
      }));
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsData = await getProducts();
      setProducts(productsData);
      setPage(1);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate HSN code (case-insensitive)
    const hsnCodeLower = formData.hsnCode.trim().toLowerCase();
    const duplicateProduct = products.find(
      (p) =>
        p.id !== editingProduct?.id &&
        p.hsnCode.trim().toLowerCase() === hsnCodeLower
    );

    if (duplicateProduct) {
      toast.error(
        `Product with HSN Code "${formData.hsnCode}" already exists: ${duplicateProduct.name}. Please edit the existing product instead.`
      );
      return;
    }

    setSaving(true);
    try {
      const gstRateNum = parseFloat(formData.gstRate) || 0;
      const purchasePriceNum = parseFloat(formData.purchasePrice) || 0;
      const sellingPriceNum =
        parseFloat(formData.sellingPrice) || parseFloat(formData.price) || 0;
      const weightNum = parseFloat(formData.weight) || 0;

      const product: Product = {
        id: editingProduct?.id || crypto.randomUUID(),
        name: formData.name,
        hsnCode: formData.hsnCode.trim(),
        gstRate: gstRateNum,
        unit: formData.unit,
        price: sellingPriceNum || purchasePriceNum, // Legacy support
        purchasePrice: purchasePriceNum,
        sellingPrice: sellingPriceNum,
        stock: editingProduct?.stock || 0, // Keep existing stock or default to 0
        whereToBuy: formData.whereToBuy,
        weight: String(weightNum),
        createdAt: editingProduct?.createdAt || new Date().toISOString(),
      };

      await saveProduct(product);

      if (addInitialStock && !editingProduct) {
        const quantityNum = parseFloat(initialStockData.quantity) || 0;
        const initPurchasePriceNum =
          parseFloat(initialStockData.purchasePrice) || 0;
        if (quantityNum > 0 && initPurchasePriceNum > 0) {
          await addStockToProduct(
            product.id,
            quantityNum,
            initPurchasePriceNum
          );
          toast.success("Product created and initial stock added");
        } else {
          toast.warning(
            "Invalid initial stock details; product created without stock"
          );
        }
      } else {
        toast.success(editingProduct ? "Product updated" : "Product added");
      }

      await loadProducts();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setAddInitialStock(false); // No initial stock for edit
    setFormData({
      name: product.name,
      hsnCode: product.hsnCode,
      gstRate: String(product.gstRate),
      unit: product.unit,
      price: product.price ? String(product.price) : "",
      purchasePrice: currentAveragePrices[product.id]
        ? Number(currentAveragePrices[product.id]).toFixed(2)
        : "",
      sellingPrice: product.sellingPrice
        ? String(product.sellingPrice)
        : product.price
          ? String(product.price)
          : "",
      stock: product.stock ? String(product.stock) : "",
      whereToBuy: product.whereToBuy || "",
      weight: product.weight ? String(product.weight) : "",
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteProduct(id);
    await loadProducts();
    toast.success("Product deleted");
  };

  const resetForm = () => {
    setEditingProduct(null);
    setAddInitialStock(false);
    setInitialStockData({ quantity: "", purchasePrice: "" });
    setFormData({
      name: "",
      hsnCode: "",
      gstRate: "",
      unit: companyProfile?.defaultUnit || "kg",
      price: "",
      purchasePrice: "",
      sellingPrice: "",
      stock: "",
      whereToBuy: "",
      weight: "",
    });
  };

  const resetStockForm = () => {
    setSelectedProductId("");
    setStockFormData({
      quantity: "",
      purchasePrice: "",
    });
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }
    const quantityNum = parseFloat(stockFormData.quantity) || 0;
    const purchasePriceNum = parseFloat(stockFormData.purchasePrice) || 0;

    if (quantityNum <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (purchasePriceNum <= 0) {
      toast.error("Purchase price must be greater than 0");
      return;
    }

    setAddingStock(true);
    try {
      await addStockToProduct(selectedProductId, quantityNum, purchasePriceNum);
      await loadProducts();
      await loadAveragePrices();
      setIsAddStockOpen(false);
      resetStockForm();
      toast.success("Stock added successfully");
    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error("Failed to add stock");
    } finally {
      setAddingStock(false);
    }
  };

  const handleCreateProductAndAddStock = async () => {
    if (!formData.name || !formData.hsnCode) {
      toast.error("Please fill in product name and HSN code");
      return;
    }
    const quantityNum = parseFloat(stockFormData.quantity) || 0;
    const purchasePriceNum = parseFloat(stockFormData.purchasePrice) || 0;

    if (quantityNum <= 0 || purchasePriceNum <= 0) {
      toast.error("Please enter quantity and purchase price");
      return;
    }

    // Check for duplicate HSN code (case-insensitive)
    const hsnCodeLower = formData.hsnCode.trim().toLowerCase();
    const duplicateProduct = products.find(
      (p) => p.hsnCode.trim().toLowerCase() === hsnCodeLower
    );

    if (duplicateProduct) {
      toast.error(
        `Product with HSN Code "${formData.hsnCode}" already exists: ${duplicateProduct.name}. Please select it from the dropdown instead.`
      );
      return;
    }

    setSaving(true);
    try {
      const weightNum = parseFloat(formData.weight) || 0;

      const product: Product = {
        id: crypto.randomUUID(),
        name: formData.name,
        hsnCode: formData.hsnCode.trim(),
        gstRate: parseFloat(formData.gstRate) || 0,
        unit: formData.unit,
        price:
          parseFloat(formData.sellingPrice) ||
          parseFloat(formData.price) ||
          purchasePriceNum,
        purchasePrice: purchasePriceNum,
        sellingPrice:
          parseFloat(formData.sellingPrice) ||
          parseFloat(formData.price) ||
          purchasePriceNum,
        stock: 0, // Will be updated by addStockToProduct
        whereToBuy: formData.whereToBuy,
        weight: String(weightNum),
        createdAt: new Date().toISOString(),
      };

      await saveProduct(product);
      await addStockToProduct(product.id, quantityNum, purchasePriceNum);
      await loadProducts();
      await loadAveragePrices();
      setIsOpen(false);
      setIsAddStockOpen(false);
      resetForm();
      resetStockForm();
      toast.success("Product created and stock added");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  // Filter products based on search query
  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      product.name.toLowerCase().includes(query) ||
      product.hsnCode.toLowerCase().includes(query) ||
      (product.unit && product.unit.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search query changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Calculate overall statistics
  const calculateStatistics = () => {
    if (products.length === 0) {
      return {
        totalProducts: 0,
        totalStock: 0,
        averagePurchasePrice: 0,
        averageSellingPrice: 0,
        averageWithCommission: 0,
        totalInventoryValue: 0,
        totalValueWithCommission: 0,
        totalProfitPotential: 0,
        averageMargin: 0,
        averageMarginPercent: 0,
      };
    }

    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

    // Use current average prices (remaining stock valued at latest cost basis)
    const totalPurchaseValue = products.reduce((sum, p) => {
      const currentAvgPrice =
        currentAveragePrices[p.id] || p.purchasePrice || 0;
      return sum + p.stock * currentAvgPrice;
    }, 0);

    const totalSellingValue = products.reduce(
      (sum, p) => sum + p.stock * (p.sellingPrice || p.price || 0),
      0
    );

    // Weighted averages based on current stock
    const averagePurchasePrice =
      totalStock > 0 ? totalPurchaseValue / totalStock : 0;

    const averageSellingPrice =
      totalStock > 0 ? totalSellingValue / totalStock : 0;

    // Average with Commission — now based on current average purchase price
    const averageWithCommission = calculateSellingPriceFromCommission(
      averagePurchasePrice,
      companyProfile?.commissionSettings
    );

    // Total inventory value at current average cost
    const totalInventoryValue = totalPurchaseValue;

    // Total Value with Commission — using current average price per product
    const totalValueWithCommission = products.reduce((sum, p) => {
      const currentAvgPrice =
        currentAveragePrices[p.id] || p.purchasePrice || 0;
      const commissionPrice = calculateSellingPriceFromCommission(
        currentAvgPrice,
        companyProfile?.commissionSettings
      );
      return sum + p.stock * commissionPrice;
    }, 0);

    // Profit potential based on current cost basis
    const totalProfitPotential = totalValueWithCommission - totalInventoryValue;

    const averageMargin = averageSellingPrice - averagePurchasePrice;
    const averageMarginPercent =
      averagePurchasePrice > 0
        ? (averageMargin / averagePurchasePrice) * 100
        : 0;

    return {
      totalProducts: products.length,
      totalStock,
      averagePurchasePrice,
      averageSellingPrice,
      averageWithCommission,
      totalInventoryValue,
      totalValueWithCommission,
      totalProfitPotential,
      averageMargin,
      averageMarginPercent,
    };
  };

  const stats = calculateStatistics();

  const handleDownloadExcel = () => {
    const formatCurr = (amount: number) => `₹${amount.toFixed(2)}`;
    const workbook = XLSX.utils.book_new();

    // SHEET 1: Summary
    const summaryData = [
      ['INVENTORY SUMMARY'],
      ['Company:', companyProfile?.name || 'Company Name'],
      ['Generated:', format(new Date(), 'dd-MM-yyyy HH:mm:ss')],
      [],
      ['Total Products', stats.totalProducts],
      ['Total Stock', stats.totalStock.toFixed(2)],
      ['Inventory Value', formatCurr(stats.totalInventoryValue)],
      ['Profit Potential', formatCurr(stats.totalProfitPotential)],
      ['Average Margin %', `${stats.averageMarginPercent.toFixed(2)}%`],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // SHEET 2: All Products
    const productsData = [
      ['Product Name', 'HSN', 'GST%', 'Unit', 'Stock', 'Purchase Price', 'Selling Price', 'Stock Value', 'Margin %'],
    ];
    products.forEach((p) => {
      const currentAvg = currentAveragePrices[p.id] || p.purchasePrice || 0;
      const selling = p.sellingPrice || p.price || 0;
      const margin = currentAvg > 0 ? ((selling - currentAvg) / currentAvg) * 100 : 0;
      productsData.push([
        p.name,
        p.hsnCode,
        String(p.gstRate),
        p.unit,
        String(p.stock),
        String(currentAvg),
        String(selling),
        String(stockValues[p.id] || 0),
        margin.toFixed(2)
      ]);
    });
    const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
    productsSheet['!cols'] = [
      { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(workbook, productsSheet, "All Products");

    // SHEET 3: Top by Value
    const topValueData = [['Rank', 'Product', 'Stock', 'Value']];
    [...products]
      .sort((a, b) => (stockValues[b.id] || 0) - (stockValues[a.id] || 0))
      .slice(0, 20)
      .forEach((p, i) => {
        topValueData.push([String(i + 1), p.name, String(p.stock), String(stockValues[p.id] || 0)]);
      });
    const topValueSheet = XLSX.utils.aoa_to_sheet(topValueData);
    topValueSheet['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, topValueSheet, "Top by Value");

    // Write file
    XLSX.writeFile(workbook, `Inventory_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success('Excel downloaded successfully');
  };

  const unitOptions: string[] = Array.from(
    new Set(
      (companyProfile?.unitOptions && companyProfile.unitOptions.length > 0
        ? companyProfile.unitOptions
        : ["kg", "pcs", "box"]
      ).concat(
        formData.unit &&
          !(companyProfile?.unitOptions || []).includes(formData.unit)
          ? [formData.unit]
          : []
      )
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner size="xl" text="Loading products..." fullScreen />
      </div>
    );
  }

  return (
    <div className="space-y-10 p-4 md:p-8 lg:p-12 max-w-[1800px] mx-auto min-h-screen pb-24 bg-background/30">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-foreground">
            Products
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl font-medium leading-relaxed">
            Manage your precious jewelry inventory with precision. Track stock levels, analyze costs, and optimize profitability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Select value={avgPriceFilter} onValueChange={setAvgPriceFilter}>
            <SelectTrigger className="w-[180px]">
              <Calculator className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Avg Price Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time Average</SelectItem>
              <SelectItem value="last3">Last 3 Bills</SelectItem>
              <SelectItem value="last5">Last 5 Bills</SelectItem>
              <SelectItem value="1month">Last 1 Month</SelectItem>
              <SelectItem value="3month">Last 3 Months</SelectItem>
              <SelectItem value="6month">Last 6 Months</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg">
                <Download className="h-5 w-5 mr-2" />
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem>
                <PDFDownloadLink
                  document={
                    <ProductsPDF
                      products={products}
                      stats={stats}
                      averagePrices={averagePrices}
                      currentAveragePrices={currentAveragePrices}
                      stockValues={stockValues}
                      companyProfile={companyProfile}
                    />
                  }
                  fileName={`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`}
                  className="w-full"
                >
                  {({ loading }: { loading: boolean }) => (
                    <div 
                    className="flex items-center text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm w-full"
                    >
                      <FilePdf className="h-4 w-4 mr-2" />
                      {loading ? "Preparing PDF..." : "PDF"}
                    </div>
                  )}
                </PDFDownloadLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" className="h-14 px-8 text-lg font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                <Plus className="h-6 w-6 mr-2" />
                Create Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[1000px] w-[95vw] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
              <DialogHeader className="p-10 bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground">
                <DialogTitle className="text-4xl font-black tracking-tight flex items-center gap-3">
                  {editingProduct ? <Edit className="h-8 w-8" /> : <PlusCircle className="h-8 w-8" />}
                  {editingProduct ? "Update Product Details" : "New Inventory Item"}
                </DialogTitle>
                <p className="text-primary-foreground/70 text-lg font-medium mt-2">
                  {editingProduct ? "Modify existing jewelry specifications and pricing." : "Register a new item into your digital catalog."}
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="p-10 space-y-10 bg-background max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-widest text-primary/40 border-b pb-2">Technical Specs</h3>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Product Title</Label>
                        <Input
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="h-14 text-xl font-bold focus-visible:ring-primary border-muted-foreground/20"
                          placeholder="e.g., 22K Gold Antique Necklace"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">HSN Code</Label>
                          <Input
                            required
                            value={formData.hsnCode}
                            onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                            className={`h-12 font-bold ${formData.hsnCode && products.some(p => p.id !== editingProduct?.id && p.hsnCode.trim().toLowerCase() === formData.hsnCode.trim().toLowerCase()) ? "border-red-500 bg-red-50 text-red-900" : "border-muted-foreground/20"}`}
                            placeholder="8-digit HSN"
                          />
                          {formData.hsnCode && products.some(p => p.id !== editingProduct?.id && p.hsnCode.trim().toLowerCase() === formData.hsnCode.trim().toLowerCase()) && (
                            <p className="text-[10px] font-black uppercase text-red-500 animate-pulse">HSN Already in use</p>
                          )}
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">GST Rate %</Label>
                          <Input
                            required
                            type="number"
                            step="0.01"
                            value={formData.gstRate}
                            onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                            className="h-12 font-bold border-muted-foreground/20"
                            placeholder="3.0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Measurement Unit</Label>
                          <Select
                            value={formData.unit}
                            onValueChange={(value) => setFormData({ ...formData, unit: value })}
                          >
                            <SelectTrigger className="h-12 font-bold border-muted-foreground/20">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {unitOptions.map((unit) => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Weight ({formData.unit})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            className="h-12 font-bold border-muted-foreground/20"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-widest text-primary/40 border-b pb-2">Financials</h3>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Purchase Cost (Excl. GST)</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input
                            required
                            type="number"
                            step="0.01"
                            value={formData.purchasePrice}
                            onChange={(e) => {
                              const purchasePrice = parseFloat(e.target.value) || 0;
                              const calculatedSellingPrice = calculateSellingPriceFromCommission(purchasePrice, companyProfile?.commissionSettings);
                              setFormData({ ...formData, purchasePrice: e.target.value, sellingPrice: purchasePrice ? String(calculatedSellingPrice) : "" });
                            }}
                            className="h-14 pl-12 text-2xl font-black border-muted-foreground/20"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground text-primary">Final Selling Price (Incl. Commission)</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                          <Input
                            required
                            type="number"
                            step="0.01"
                            value={formData.sellingPrice}
                            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                            className="h-14 pl-12 text-2xl font-black border-primary/30 ring-2 ring-primary/5 shadow-inner"
                            placeholder="0.00"
                          />
                        </div>
                        {parseFloat(formData.purchasePrice || "0") > 0 && (
                          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                            <span className="text-sm font-bold text-primary">Profit ROI</span>
                            <span className="text-xl font-black text-primary">
                              {parseFloat(formData.sellingPrice || "0") > parseFloat(formData.purchasePrice || "0") 
                                ? `${(((parseFloat(formData.sellingPrice || "0") - parseFloat(formData.purchasePrice || "0")) / parseFloat(formData.purchasePrice || "1")) * 100).toFixed(1)}%`
                                : "0%"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Primary Supplier</Label>
                        <Input
                          value={formData.whereToBuy}
                          onChange={(e) => setFormData({ ...formData, whereToBuy: e.target.value })}
                          className="h-12 font-bold border-muted-foreground/20"
                          placeholder="Source vendor"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {!editingProduct && (
                  <div className="p-8 rounded-3xl bg-accent/20 border-2 border-dashed border-primary/20 space-y-6">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="addInitialStock"
                        checked={addInitialStock}
                        onCheckedChange={(checked) => setAddInitialStock(!!checked)}
                        className="h-6 w-6 rounded-lg data-[state=checked]:bg-primary"
                      />
                      <label htmlFor="addInitialStock" className="text-lg font-black tracking-tight cursor-pointer">Register Opening Stock Now?</label>
                    </div>
                    {addInitialStock && (
                      <div className="grid grid-cols-2 gap-8 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Opening Quantity</Label>
                          <Input
                            required
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={initialStockData.quantity}
                            onChange={(e) => setInitialStockData({ ...initialStockData, quantity: e.target.value })}
                            className="h-14 text-xl font-bold bg-background border-muted-foreground/20"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cost Price / Unit</Label>
                          <Input
                            required
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={initialStockData.purchasePrice}
                            onChange={(e) => setInitialStockData({ ...initialStockData, purchasePrice: e.target.value })}
                            className="h-14 text-xl font-bold bg-background border-muted-foreground/20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 pt-10 sticky bottom-0 bg-background/90 backdrop-blur-md pb-2">
                  <Button type="button" variant="ghost" onClick={() => { setIsOpen(false); resetForm(); }} className="h-16 flex-1 text-lg font-bold hover:bg-destructive/10 hover:text-destructive">
                    Discard
                  </Button>
                  <Button type="submit" disabled={saving} className="h-16 flex-[2] text-xl font-black shadow-2xl shadow-primary/30">
                    {saving ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {editingProduct ? <Save className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
                        <span>{editingProduct ? "Sync Changes" : "Commit to Inventory"}</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
      <Dialog
        open={isAddStockOpen}
        onOpenChange={(open) => {
          setIsAddStockOpen(open);
          if (!open) resetStockForm();
        }}
      >
        <DialogTrigger asChild>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold border-2 hover:bg-accent/50 transition-all">
            <PlusCircle className="h-6 w-6 mr-2" />
            Add Stock
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-8 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
            <DialogTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Package className="h-8 w-8" />
              Replenish Stock
            </DialogTitle>
            <p className="text-emerald-100 text-base font-medium mt-1">Update your inventory levels with new arrivals.</p>
          </DialogHeader>
          <form onSubmit={handleAddStock} className="p-8 space-y-8 bg-background">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Jewelry Item</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                  required
                >
                  <SelectTrigger className="h-14 text-lg font-bold border-muted-foreground/20">
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id} className="text-base py-3">
                        {product.name} <span className="text-muted-foreground font-normal ml-2">({product.hsnCode})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProductId && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/30 border border-accent">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <p className="text-sm font-bold">
                      Current: {products.find((p) => p.id === selectedProductId)?.stock || 0} {products.find((p) => p.id === selectedProductId)?.unit || ""}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Quantity to Add</Label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={stockFormData.quantity}
                    onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                    className="h-14 text-xl font-black border-muted-foreground/20"
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Unit Cost Price</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={stockFormData.purchasePrice}
                      onChange={(e) => setStockFormData({ ...stockFormData, purchasePrice: e.target.value })}
                      className="h-14 pl-12 text-xl font-black border-muted-foreground/20"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-6 rounded-2xl space-y-3">
              <p className="text-sm font-bold text-muted-foreground">New item not listed yet?</p>
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-primary font-black uppercase tracking-widest text-xs"
                onClick={() => {
                  setIsAddStockOpen(false);
                  setIsOpen(true);
                }}
              >
                + Register New Product Category
              </Button>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                className="h-14 flex-1 text-base font-bold"
                onClick={() => {
                  setIsAddStockOpen(false);
                  resetStockForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingStock || !selectedProductId}
                className="h-14 flex-[2] text-lg font-black shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
              >
                {addingStock ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Syncing...</span>
                  </div>
                ) : (
                  "Confirm Arrival"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      {products.length > 0 && (
        <Card className="w-full">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products by name or HSN code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full text-sm sm:text-base"
              />
            </div>
            {searchQuery && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Found {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "product" : "products"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics and Analytics Section */}
      {products.length > 0 && (
        <div className="space-y-8 mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent border-blue-200/50 dark:border-blue-800/50 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <CardContent className="pt-8 px-6 pb-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600/70 dark:text-blue-400/70">
                      Total Products
                    </p>
                    <p className="text-4xl md:text-5xl font-black tracking-tight text-blue-700 dark:text-blue-400">
                      {stats.totalProducts}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                       <Package className="h-4 w-4 text-blue-600/50" />
                       <p className="text-xs font-semibold text-muted-foreground">
                        {roundToTwoDecimals(stats.totalStock).toFixed(2)} units
                      </p>
                    </div>
                  </div>
                  <div className="h-16 w-16 rounded-3xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Package className="h-9 w-9 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-600/10 via-emerald-500/5 to-transparent border-emerald-200/50 dark:border-emerald-800/50 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <CardContent className="pt-8 px-6 pb-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600/70 dark:text-emerald-400/70">
                      Inventory Value
                    </p>
                    <p className="text-4xl md:text-5xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(stats.totalInventoryValue)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                       <DollarSign className="h-4 w-4 text-emerald-600/50" />
                       <p className="text-xs font-semibold text-muted-foreground">
                        At average cost
                      </p>
                    </div>
                  </div>
                  <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <DollarSign className="h-9 w-9 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-600/10 via-purple-500/5 to-transparent border-purple-200/50 dark:border-purple-800/50 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <CardContent className="pt-8 px-6 pb-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600/70 dark:text-purple-400/70">
                      Sales Value
                    </p>
                    <p className="text-4xl md:text-5xl font-black tracking-tight text-purple-700 dark:text-purple-400">
                      {formatCurrency(stats.totalValueWithCommission)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                       <Calculator className="h-4 w-4 text-purple-600/50" />
                       <p className="text-xs font-semibold text-muted-foreground">
                        Projected revenue
                      </p>
                    </div>
                  </div>
                  <div className="h-16 w-16 rounded-3xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Calculator className="h-9 w-9 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-600/10 via-orange-500/5 to-transparent border-orange-200/50 dark:border-orange-800/50 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <CardContent className="pt-8 px-6 pb-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600/70 dark:text-orange-400/70">
                      Profit Margin
                    </p>
                    <p className="text-4xl md:text-5xl font-black tracking-tight text-orange-700 dark:text-orange-400">
                      {formatCurrency(stats.totalProfitPotential)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                       <TrendingUp className="h-4 w-4 text-orange-600/50" />
                       <p className="text-xs font-semibold text-muted-foreground">
                        {stats.averageMarginPercent > 0
                          ? `${roundToTwoDecimals(stats.averageMarginPercent).toFixed(1)}% ROI`
                          : "ROI Projection"}
                      </p>
                    </div>
                  </div>
                  <div className="h-16 w-16 rounded-3xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-9 w-9 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No products added yet</p>
            <Button onClick={() => setIsOpen(true)}>
              Add your first product
            </Button>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              No products found matching your search
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedProducts.map((product) => {
            const sellingPrice = roundToTwoDecimals(
              product.sellingPrice || product.price || 0
            );
            const purchasePrice = roundToTwoDecimals(
              product.purchasePrice || 0
            );

            // Use current average price for commission and profit calculations
            const currentAvgPurchasePrice = roundToTwoDecimals(
              currentAveragePrices[product.id] || purchasePrice
            );

            const margin = roundToTwoDecimals(
              sellingPrice - currentAvgPurchasePrice
            );
            const marginPercent =
              currentAvgPurchasePrice > 0
                ? roundToTwoDecimals((margin / currentAvgPurchasePrice) * 100)
                : 0;

            const stockValue = roundToTwoDecimals(
              product.stock * currentAvgPurchasePrice
            );

            const stockValueWithCommission = roundToTwoDecimals(
              product.stock *
              calculateSellingPriceFromCommission(
                currentAvgPurchasePrice,
                companyProfile?.commissionSettings
              )
            );

            const profitPotential = roundToTwoDecimals(
              stockValueWithCommission - stockValue
            );

            return (
              <Card
                key={product.id}
                className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold truncate">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          {product.hsnCode}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          GST: {product.gstRate}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {product.name}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(product.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stock Information */}
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Stock
                      </span>
                      <span
                        className={`text-lg font-bold ${product.stock < 10
                          ? "text-orange-600"
                          : "text-emerald-600"
                          }`}
                      >
                        {product.stock % 1 === 0
                          ? product.stock
                          : roundToTwoDecimals(product.stock).toFixed(2)}{" "}
                        {product.unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>Avg Purchase Price</span>
                      <span className="font-medium">
                        {formatCurrency(
                          averagePrices[product.id] || purchasePrice
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                      <span>Weight</span>
                      <span className="font-medium">
                        {product.weight != null ? product.weight : "N/A"}{" "}
                        {product.unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                      <span>Bought from where</span>
                      <span className="font-medium">
                        {product.whereToBuy || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Profit Analysis */}
                  {currentAvgPurchasePrice > 0 && (
                    <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-3 rounded-lg space-y-2 border border-emerald-200/50">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-sm font-medium">
                          Current Avg Purchase Price
                        </span>
                        <span className="font-medium text-black-600">
                          {" "}
                          {formatCurrency(
                            currentAveragePrices[product.id] || purchasePrice
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          Stock Value
                        </span>
                        <span className="font-medium">
                          {formatCurrency(stockValues[product.id])}
                        </span>
                      </div>
                      {companyProfile?.commissionSettings && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              Selling Price
                            </span>
                            <span className="font-medium text-purple-600">
                              {formatCurrency(stockValueWithCommission)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setHistoryProduct(product);
                      setIsHistoryOpen(true);
                    }}
                  >
                    <History className="h-4 w-4 mr-2" />
                    View Detailed History
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {filteredProducts.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {historyProduct && (
        <ProductHistory
          product={historyProduct}
          open={isHistoryOpen}
          onOpenChange={(open) => {
            setIsHistoryOpen(open);
            if (!open) {
              setHistoryProduct(null);
            }
          }}
        />
      )}
    </div>
  );
}
