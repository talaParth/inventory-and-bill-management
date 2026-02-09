import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPurchaseBills,
  getProducts,
  savePurchaseBill,
  deletePurchaseBill,
  updatePurchaseBillPayment,
  deletePurchaseBillPayment,
  savePurchaseReturn,
  deletePurchaseReturn,
  addPurchaseItemsToInventory,
  isPurchaseBillDuplicate,
  updatePurchaseBillOverdueStatus,
  isPurchaseBillInventoryAdded,
  updatePurchaseBill,
  InventoryItemInput,
  getCompanyProfile,
} from "@/lib/storage";
import { extractBillFromImage } from "@/lib/aiExtractor";
import {
  PurchaseBill,
  PurchaseBillItem,
  AIExtractionError,
  ProductConflict,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { PaymentDialog } from "@/components/PaymentDialog";
import {
  formatCurrency,
  formatDate,
  calculateSellingPriceFromCommission,
} from "@/lib/billUtils";
import { PurchaseReturnForm } from "@/components/PurchaseReturnForm";
import {
  RotateCcw,
  Upload,
  Camera,
  Search,
  Eye,
  Trash2,
  Loader2,
  FileText,
  CheckCircle,
  Clock,
  ImageIcon,
  PackagePlus,
  AlertTriangle,
  Edit2,
  Save,
  X,
  AlertCircle,
  Image,
  IndianRupee,
  Calendar,
  BookOpen,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ConflictResolutionDialog } from "@/components/ConflictResolutionDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { compressFile, getBase64SizeKB } from "@/lib/imageCompression";

export default function PurchaseBills() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<PurchaseBill[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gstFilter, setGstFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedBill, setSelectedBill] = useState<PurchaseBill | null>(null);
  const [viewImageBill, setViewImageBill] = useState<PurchaseBill | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBillForHistory, setSelectedBillForHistory] = useState<PurchaseBill | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedBillForReturn, setSelectedBillForReturn] = useState<PurchaseBill | null>(null);

  const openHistoryDialog = (bill: PurchaseBill) => {
    setSelectedBillForHistory(bill);
    setHistoryDialogOpen(true);
  };

  const getPurchaseHistory = (bill: PurchaseBill) => {
    const history: any[] = [];
    
    // Add the original purchase
    history.push({
      id: `purchase-${bill.id}`,
      date: bill.billDate || bill.createdAt,
      type: 'purchase',
      description: `Purchase - Bill #${bill.billNumber || 'N/A'}`,
      amount: -bill.total,
    });

    // Add payments
    if (bill.payments && bill.payments.length > 0) {
      bill.payments.forEach(payment => {
        history.push({
          id: `payment-${payment.id}`,
          date: payment.date,
          type: 'payment',
          description: `Payment Made (${payment.method})${payment.note ? ` - ${payment.note}` : ''}`,
          amount: payment.amount,
        });
      });
    }

    // Add returns
    if (bill.returns && bill.returns.length > 0) {
      bill.returns.forEach(ret => {
        const productNames = ret.items.map(item => item.description).join(", ");
        history.push({
          id: `return-${ret.id}`,
          date: ret.returnDate,
          type: 'return',
          description: `Purchase Return (${productNames})${ret.notes ? ` - ${ret.notes}` : ''}`,
          amount: ret.totalReturnValue,
        });
      });
    }

    // Sort by date descending
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [transactionAmount, setTransactionAmount] = useState<string>("");

  const [editingReturn, setEditingReturn] = useState<any>(null);

  const handleEditTransaction = (entry: any) => {
    if (entry.type === 'payment') {
      setEditingTransaction(entry);
      setTransactionAmount(entry.amount.toString());
    } else if (entry.type === 'return') {
      const returnObj = selectedBillForHistory?.returns?.find(r => `return-${r.id}` === entry.id);
      if (returnObj && selectedBillForHistory) {
        setEditingReturn(returnObj);
        setSelectedBillForReturn(selectedBillForHistory);
        setReturnDialogOpen(true);
      }
    }
  };

  const saveEditedTransaction = async () => {
    if (!editingTransaction || !selectedBillForHistory) return;
    try {
      const amount = parseFloat(transactionAmount);
      if (isNaN(amount)) return;

      const paymentId = editingTransaction.id.replace('payment-', '');
      await updatePurchaseBillPayment(
        selectedBillForHistory.id,
        amount,
        editingTransaction.method || 'Cash',
        editingTransaction.note,
        editingTransaction.date,
        paymentId
      );
      
      toast({ title: "Success", description: "Payment updated successfully" });
      setEditingTransaction(null);
      await loadBills();
      // Update history dialog view
      const updatedBill = bills.find(b => b.id === selectedBillForHistory.id);
      if (updatedBill) setSelectedBillForHistory(updatedBill);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update payment", variant: "destructive" });
    }
  };

  const handleDeleteTransaction = async (entry: any) => {
    if (!selectedBillForHistory) return;
    try {
      if (entry.type === 'payment') {
        const paymentId = entry.id.replace('payment-', '');
        await deletePurchaseBillPayment(selectedBillForHistory.id, paymentId);
        toast({ title: "Deleted", description: "Payment removed" });
      } else if (entry.type === 'return') {
        const returnId = entry.id.replace('return-', '');
        await deletePurchaseReturn(returnId, selectedBillForHistory.id);
        toast({ title: "Deleted", description: "Return removed and stock reverted" });
      }
      await loadBills();
      const updatedBill = bills.find(b => b.id === selectedBillForHistory.id);
      if (updatedBill) setSelectedBillForHistory(updatedBill);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    }
  };
  const [editedBill, setEditedBill] = useState<PurchaseBill | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<PurchaseBill | null>(null);
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null);
  const [loadingInventory, setLoadingInventory] = useState<string | null>(null);
  const [savingEditedBill, setSavingEditedBill] = useState(false);
  const [productConflicts, setProductConflicts] = useState<ProductConflict[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [pendingInventoryBill, setPendingInventoryBill] =
    useState<PurchaseBill | null>(null);
  const [pendingInventoryItems, setPendingInventoryItems] = useState<
    InventoryItemInput[]
  >([]);
  const [lastInventoryError, setLastInventoryError] = useState<string | null>(
    null
  );

  // Inventory dialog state
  const [inventoryDialogBill, setInventoryDialogBill] =
    useState<PurchaseBill | null>(null);
  const [inventoryItems, setInventoryItems] = useState<
    {
      description: string;
      hsnCode: string;
      quantity: number;
      unit: string;
      purchasePrice: number;
      sellingPrice: number;
      gstRate: number;
      productId?: string;
      isNewProduct?: boolean;
    }[]
  >([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    // Update overdue status on load
    updatePurchaseBillOverdueStatus().catch(console.error);
    loadBills();
    loadCompanyProfile();
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const formatErrorForUser = (error: unknown) => {
    try {
      const e = error as any;
      const basic =
        typeof e?.message === "string"
          ? e.message
          : typeof error === "string"
          ? error
          : "Unknown error";

      const meta: any = {};
      if (e?.code) meta.code = e.code;
      if (e?.name) meta.name = e.name;
      if (e?.stack) meta.stack = e.stack;

      return [
        `Message: ${basic}`,
        meta.code ? `Code: ${meta.code}` : null,
        meta.name ? `Name: ${meta.name}` : null,
        `Online: ${typeof navigator !== "undefined" ? navigator.onLine : "unknown"}`,
        `UserAgent: ${
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
        }`,
        meta.stack ? `\nStack:\n${meta.stack}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      return "Unknown error (failed to format error details)";
    }
  };

  const loadCompanyProfile = async () => {
    const profile = await getCompanyProfile();
    setCompanyProfile(profile);
  };

  useEffect(() => {
    filterAndSortBills();
  }, [bills, searchTerm, statusFilter, gstFilter, sortBy]);

  const loadBills = async () => {
    setLoading(true);
    const data = await getPurchaseBills();
    setBills(data);
    setPage(1);
    setLoading(false);
  };

  const filterAndSortBills = () => {
    let filtered = [...bills];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (bill) =>
          bill.vendorName.toLowerCase().includes(term) ||
          bill.billNumber?.toLowerCase().includes(term) ||
          bill.items.some((item) =>
            item.description.toLowerCase().includes(term)
          )
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((bill) => bill.paymentStatus === statusFilter);
    }

    // GST filter
    if (gstFilter !== "all") {
      if (gstFilter === "gst") {
        filtered = filtered.filter((bill) => bill.totalTax > 0);
      } else if (gstFilter === "non-gst") {
        filtered = filtered.filter((bill) => bill.totalTax === 0);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "date-asc":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "amount-desc":
          return b.total - a.total;
        case "amount-asc":
          return a.total - b.total;
        case "vendor":
          return a.vendorName.localeCompare(b.vendorName);
        case "due-date":
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        default:
          return 0;
      }
    });

    setFilteredBills(filtered);
  };

  useEffect(() => {
    setPage(1);
  }, [filteredBills.length, searchTerm, statusFilter, gstFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setIsCompressing(true);

    toast({
      title: "Processing Image",
      description: "Optimizing image for AI processing...",
    });

    try {
      const compressedBase64 = await compressFile(file, 900);
      const sizeKB = getBase64SizeKB(compressedBase64);

      if (sizeKB > 1000) {
        toast({
          title: "Image Too Large",
          description: `Image is ${sizeKB.toFixed(
            0
          )} KB. Please try a different photo.`,
          variant: "destructive",
        });
        setIsCompressing(false);
        return;
      }

      await processImage(compressedBase64);
    } catch (error) {
      console.error("Error processing image:", error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompressing(false);
    }

    e.target.value = "";
  };

  const processImage = async (imageBase64: string) => {
    setIsExtracting(true);

    try {
      toast({
        title: "Processing",
        description: "AI is extracting bill information...",
      });

      const extracted = await extractBillFromImage(imageBase64);

      // Check for duplicate bill
      if (
        extracted.billNumber &&
        (await isPurchaseBillDuplicate(
          extracted.billNumber,
          extracted.vendorName
        ))
      ) {
        toast({
          title: "Duplicate Bill",
          description: `Bill #${extracted.billNumber} from ${extracted.vendorName} already exists`,
          variant: "destructive",
        });
        setIsExtracting(false);
        return;
      }

      // Calculate due date from payment terms if not provided
      let dueDate = extracted.dueDate;
      if (!dueDate && extracted.paymentTerms && extracted.billDate) {
        const billDate = new Date(extracted.billDate);
        billDate.setDate(billDate.getDate() + extracted.paymentTerms);
        dueDate = billDate.toISOString().split("T")[0];
      }

      const newBill: PurchaseBill = {
        id: crypto.randomUUID(),
        billImage: imageBase64,
        vendorName: extracted.vendorName,
        vendorAddress: extracted.vendorAddress,
        vendorGstin: extracted.vendorGstin,
        billNumber: extracted.billNumber,
        billDate: extracted.billDate,
        dueDate,
        paymentTerms: extracted.paymentTerms,
        items: extracted.items,
        subtotal: extracted.subtotal,
        totalTax: extracted.totalTax,
        total: extracted.total,
        paymentStatus: "pending",
        paidAmount: 0,
        payments: [],
        extractedRawText: extracted.rawText,
        extractionErrors: extracted.errors,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await savePurchaseBill(newBill);
      await loadBills();

      // Show warnings if any
      if (extracted.errors.length > 0) {
        toast({
          title: "Bill Extracted with Warnings",
          description: `${extracted.errors.length} issue(s) found. Please review and fix.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: "Bill extracted and saved successfully!",
        });
      }

      // Open the detail view
      setSelectedBill(newBill);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to process bill",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePurchaseBill(id);
    await loadBills();
    toast({
      title: "Deleted",
      description: "Purchase bill deleted successfully",
    });
  };

  const handlePaymentCollected = async (amount: number, type: any, note?: string, date?: string) => {
    if (selectedBillForPayment) {
      setLoadingPayment(selectedBillForPayment.id);
      try {
        await updatePurchaseBillPayment(selectedBillForPayment.id, amount, type, note, date);
        await loadBills();
        toast({
          title: "Payment Collected",
          description: `Payment of ${formatCurrency(amount)} via ${type} recorded.`,
        });
      } catch (error) {
        console.error("Error collecting payment:", error);
        toast({
          title: "Error",
          description: "Failed to record payment",
          variant: "destructive",
        });
      } finally {
        setLoadingPayment(null);
      }
    }
  };

  const openPaymentDialog = (bill: PurchaseBill) => {
    setSelectedBillForPayment(bill);
    setPaymentDialogOpen(true);
  };

  const handleTogglePayment = async (bill: PurchaseBill) => {
    // Legacy support or fallback
    openPaymentDialog(bill);
  };

  const handleAddToInventory = async (bill: PurchaseBill) => {
    // Check if already added using the storage function
    const isAdded = await isPurchaseBillInventoryAdded(bill.id);
    if (bill.itemsAddedToInventory || isAdded) {
      toast({
        title: "Already Added",
        description: `Items were added to inventory on ${formatDate(
          bill.inventoryAddedAt || bill.createdAt
        )}`,
        variant: "destructive",
      });
      return;
    }

    // Open dialog to enter selling prices
    // Use commission settings from company profile to calculate default selling price
    const products = await getProducts();
    const items = bill.items.map((item) => {
      const existingProduct = products.find(
        (p) => p.name.toLowerCase() === item.description.toLowerCase() || p.hsnCode === item.hsnCode
      );
      
      return {
        description: item.description,
        hsnCode: item.hsnCode || "",
        quantity: item.quantity,
        unit: item.unit,
        purchasePrice: item.rate,
        sellingPrice: calculateSellingPriceFromCommission(
          item.rate,
          companyProfile?.commissionSettings
        ),
        gstRate: item.gstRate || 0,
        whereToBuy: (item as any).whereToBuy || bill.vendorName || "",
        weight: (item as any).weight || "",
        productId: existingProduct?.id,
        isNewProduct: !existingProduct,
      };
    });

    setInventoryItems(items);
    setInventoryDialogBill(bill);
  };

  const confirmAddToInventory = async (
    conflictResolutions?: Map<string, string>
  ) => {
    if (!inventoryDialogBill) return;

    setLoadingInventory(inventoryDialogBill.id);
    try {
      // Validate all selling prices
      const hasInvalidPrices = inventoryItems.some(
        (item) => item.sellingPrice <= 0
      );
      if (hasInvalidPrices) {
        toast({
          title: "Invalid Prices",
          description: "Please enter valid selling prices for all items",
          variant: "destructive",
        });
        setLoadingInventory(null);
        return;
      }

      const itemsInput: InventoryItemInput[] = inventoryItems.map((item) => ({
        description: item.description,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unit: item.unit,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        gstRate: item.gstRate,
        productId: item.productId,
        isNewProduct: item.isNewProduct,
      }));

      const result = await addPurchaseItemsToInventory(
        inventoryDialogBill,
        itemsInput,
        conflictResolutions
      );

      // Check if there are conflicts
      if (result.conflicts && result.conflicts.length > 0) {
        // Store the data for later use
        setPendingInventoryBill(inventoryDialogBill);
        setPendingInventoryItems(itemsInput);
        setProductConflicts(result.conflicts);
        setInventoryDialogBill(null); // Close the selling price dialog
        setLoadingInventory(null);
        return;
      }

      setInventoryDialogBill(null);
      setInventoryItems([]);

      toast({
        title: "Added to Inventory",
        description: `${result.added} new product(s), ${result.updated} updated`,
      });

      // Reload bills in a separate step.
      // On mobile, a transient reload failure was showing as "add failed"
      // even when the inventory add succeeded.
      try {
        await loadBills();
      } catch (reloadErr) {
        const details = formatErrorForUser(reloadErr);
        setLastInventoryError(details);
        toast({
          title: "Added, but refresh failed",
          description:
            "Inventory was updated, but the list couldn't refresh. Open details and copy the error if it keeps happening.",
          variant: "destructive",
        });
      }

      // Update selectedBill state if it matches
      if (selectedBill && selectedBill.id === inventoryDialogBill.id) {
        setSelectedBill({
          ...selectedBill,
          itemsAddedToInventory: true,
          inventoryAddedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error adding to inventory:", error);
      const details = formatErrorForUser(error);
      setLastInventoryError(details);
      toast({
        title: "Error",
        description:
          "Failed to add items to inventory. Tap 'Details' to copy the error.",
        variant: "destructive",
      });
    } finally {
      setLoadingInventory(null);
    }
  };

  const handleConflictCancel = () => {
    setProductConflicts([]);
    setPendingInventoryBill(null);
    setPendingInventoryItems([]);
  };

  const handleConflictResolution = async (resolutions: Map<string, string>) => {
    if (!pendingInventoryBill || !pendingInventoryItems) return;

    setLoadingInventory(pendingInventoryBill.id);
    try {
      const result = await addPurchaseItemsToInventory(
        pendingInventoryBill,
        pendingInventoryItems,
        resolutions
      );

      await loadBills();

      if (selectedBill && selectedBill.id === pendingInventoryBill.id) {
        setSelectedBill({
          ...selectedBill,
          itemsAddedToInventory: true,
          inventoryAddedAt: new Date().toISOString(),
        });
      }

      setProductConflicts([]);
      setPendingInventoryBill(null);
      setPendingInventoryItems([]);

      toast({
        title: "Added to Inventory",
        description: `${result.added} new product(s), ${result.updated} updated`,
      });
    } catch (error) {
      console.error("Error adding to inventory:", error);
      toast({
        title: "Error",
        description: "Failed to add items to inventory",
        variant: "destructive",
      });
    } finally {
      setLoadingInventory(null);
    }
  };

  const updateInventoryItemSellingPrice = (
    index: number,
    sellingPrice: number
  ) => {
    const items = [...inventoryItems];
    items[index].sellingPrice = sellingPrice;
    setInventoryItems(items);
  };

  const startEditing = (bill: PurchaseBill) => {
    const clone: PurchaseBill = JSON.parse(JSON.stringify(bill));
    // Auto-fill item-level "Bought from" with Vendor Name if missing
    clone.items = (clone.items || []).map((it) => ({
      ...it,
      whereToBuy:
        (it as any).whereToBuy && String((it as any).whereToBuy).trim()
          ? (it as any).whereToBuy
          : clone.vendorName || "",
    }));
    setEditedBill(clone);
    setIsEditing(true);
  };

  const addEditedItemRow = () => {
    if (!editedBill) return;
    const newItem: PurchaseBillItem = {
      description: "",
      hsnCode: "",
      quantity: 1,
      unit: "pcs",
      rate: 0,
      amount: 0,
      gstRate: 0,
      gstAmount: 0,
      whereToBuy: editedBill.vendorName || "",
      weight: "",
      hasError: false,
    };
    setEditedBill({ ...editedBill, items: [...editedBill.items, newItem] });
  };

  const removeEditedItemRow = (index: number) => {
    if (!editedBill) return;
    const items = editedBill.items.filter((_, i) => i !== index);
    setEditedBill({ ...editedBill, items });
  };

  const saveEditedBill = async () => {
    if (!editedBill) return;

    setSavingEditedBill(true);
    try {
      // Recalculate totals
      const subtotal = editedBill.items.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      const totalTax = editedBill.items.reduce(
        (sum, item) => sum + (item.gstAmount || 0),
        0
      );
      const total = subtotal + totalTax;

      const updatedBill: PurchaseBill = {
        ...editedBill,
        subtotal,
        totalTax,
        total,
        extractionErrors: [], // Clear errors after manual fix
        updatedAt: new Date().toISOString(),
      };

      await updatePurchaseBill(updatedBill);
      await loadBills();
      if (selectedBill && selectedBill.id === updatedBill.id) {
        setSelectedBill(updatedBill);
      }
      setIsEditing(false);
      setEditedBill(null);

      toast({
        title: "Saved",
        description: "Bill updated successfully",
      });
    } catch (error) {
      console.error("Error saving edited bill:", error);
      toast({
        title: "Error",
        description: "Failed to save bill",
        variant: "destructive",
      });
    } finally {
      setSavingEditedBill(false);
    }
  };

  const updateEditedItem = (
    index: number,
    field: keyof PurchaseBillItem,
    value: any
  ) => {
    if (!editedBill) return;

    const items = [...editedBill.items];
    const item = { ...items[index] };

    (item as any)[field] = value;

    // Recalculate amount
    if (field === "quantity" || field === "rate") {
      item.amount = item.quantity * item.rate;
      item.gstAmount = (item.amount * (item.gstRate || 0)) / 100;
    }
    if (field === "gstRate") {
      item.gstAmount = (item.amount * (value || 0)) / 100;
    }

    // Clear error flag after edit
    item.hasError = false;
    item.errorMessage = undefined;

    items[index] = item;
    setEditedBill({ ...editedBill, items });
  };

  const isOverdue = (bill: PurchaseBill) => {
    if (bill.paymentStatus === "paid" || !bill.dueDate) return false;
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const getDaysUntilDue = (bill: PurchaseBill) => {
    if (!bill.dueDate || bill.paymentStatus === "paid") return null;
    const dueDate = new Date(bill.dueDate);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPaymentStatusBadge = (bill: PurchaseBill) => {
    const isOverdueVal = isOverdue(bill);
    const status = bill.paymentStatus;
    const paidAmount = bill.paidAmount || 0;

    if (status === "paid") {
      return (
        <Badge
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="h-3 w-3 mr-1" /> Paid
        </Badge>
      );
    }

    if (paidAmount > 0) {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-400">
          <Clock className="h-3 w-3 mr-1" /> Partial ({formatCurrency(paidAmount)})
        </Badge>
      );
    }

    if (isOverdueVal || status === "overdue") {
      return (
        <Badge variant="destructive" className="animate-pulse">
          <AlertCircle className="h-3 w-3 mr-1" /> Overdue
        </Badge>
      );
    }

    const daysUntilDue = getDaysUntilDue(bill);
    if (daysUntilDue !== null && daysUntilDue <= 3) {
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 border-amber-300"
        >
          <Clock className="h-3 w-3 mr-1" /> Due in {daysUntilDue} day(s)
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner size="xl" text="Loading products..." fullScreen />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Purchase Bills
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered bill extraction with validation
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isExtracting || isCompressing}
          >
            {isCompressing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {isCompressing ? "Processing..." : "Camera"}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting || isCompressing}
          >
            {isCompressing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isExtracting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isCompressing
              ? "Processing..."
              : isExtracting
              ? "Extracting..."
              : "Upload Bill"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor, bill number, items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gstFilter} onValueChange={setGstFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="GST Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bills</SelectItem>
            <SelectItem value="gst">GST Bills</SelectItem>
            <SelectItem value="non-gst">Non-GST Bills</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="due-date">Due Date</SelectItem>
            <SelectItem value="amount-desc">Amount (High)</SelectItem>
            <SelectItem value="amount-asc">Amount (Low)</SelectItem>
            <SelectItem value="vendor">Vendor Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isExtracting && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-3 text-foreground font-medium">
              AI is analyzing your bill...
            </p>
            <p className="text-sm text-muted-foreground">
              Extracting vendor info, items, amounts, and validating
              calculations
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bills List */}
      {filteredBills.length === 0 && !isExtracting ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              No purchase bills found
            </p>
            <p className="text-sm text-muted-foreground">
              Upload a bill image to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pagedBills.map((bill) => (
            <Card
              key={bill.id}
              className={`hover:shadow-md transition-shadow ${
                isOverdue(bill) || bill.paymentStatus === "overdue"
                  ? "border-destructive/50 bg-destructive/5"
                  : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Bill Image Thumbnail */}
                  <div
                    className="w-full sm:w-20 h-20 bg-muted rounded-lg overflow-hidden cursor-pointer flex-shrink-0"
                    onClick={() => setViewImageBill(bill)}
                  >
                    <img
                      src={bill.billImage}
                      alt="Bill"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Bill Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground truncate">
                          {bill.vendorName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {bill.billNumber
                            ? `#${bill.billNumber}`
                            : "No bill number"}{" "}
                          • {formatDate(bill.billDate || bill.createdAt)}
                        </p>
                        {bill.dueDate && (
                          <p
                            className={`text-xs mt-1 ${
                              isOverdue(bill)
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            Due: {formatDate(bill.dueDate)}
                            {bill.paymentTerms
                              ? ` (${bill.paymentTerms} days)`
                              : ""}
                          </p>
                        )}
                      </div>
                          <div className="flex flex-col items-end gap-1">
                            <div
                              className={`cursor-pointer ${
                                loadingPayment === bill.id
                                  ? "opacity-50 pointer-events-none"
                                  : ""
                              }`}
                              onClick={() => openPaymentDialog(bill)}
                            >
                              {loadingPayment === bill.id ? (
                                <Badge variant="secondary">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />{" "}
                                  Updating...
                                </Badge>
                              ) : (
                                <div className="flex flex-col gap-1 items-end">
                                  {getPaymentStatusBadge(bill)}
                                  {bill.paymentStatus !== "paid" && (
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      Paid: {formatCurrency(bill.paidAmount || 0)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                        {bill.extractionErrors &&
                          bill.extractionErrors.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-400"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />{" "}
                              {bill.extractionErrors.length} issue(s)
                            </Badge>
                          )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <PackagePlus className="h-3.5 w-3.5" />
                        <span>{bill.items.length} item(s)</span>
                      </div>
                      {bill.vendorGstin && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs">GSTIN:</span>
                          <span className="text-xs">{bill.vendorGstin}</span>
                        </div>
                      )}
                      {bill.itemsAddedToInventory && (
                        <Badge
                          variant="outline"
                          className="text-emerald-600 border-emerald-500 bg-emerald-50/50"
                        >
                          <PackagePlus className="h-3 w-3 mr-1" /> In Inventory
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t pt-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total:</span>
                          <p className="text-xl font-bold text-foreground">
                            {formatCurrency(
                              bill.total - (bill.returns?.reduce((sum, r) => sum + r.totalReturnValue, 0) || 0)
                            )}
                          </p>
                        </div>
                        {bill.paidAmount > 0 && bill.payments && bill.payments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {Object.entries(
                              bill.payments.reduce((acc, p) => {
                                acc[p.method] = (acc[p.method] || 0) + p.amount;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([method, amount]) => (
                              <Badge key={method} variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex items-center gap-1 bg-muted/30 border-dashed">
                                <span className="opacity-70">{method}:</span>
                                <span className="font-bold">{formatCurrency(amount)}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBillForReturn(bill);
                              setReturnDialogOpen(true);
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            Return
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPaymentDialog(bill);
                            }}
                            disabled={bill.paymentStatus === "paid"}
                          >
                            <IndianRupee className="h-3.5 w-3.5" />
                            Pay
                          </Button>
                        {!bill.itemsAddedToInventory && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddToInventory(bill)}
                            disabled={loadingInventory === bill.id}
                            className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                          >
                            {loadingInventory === bill.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PackagePlus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setViewImageBill(bill)}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setSelectedBill(bill)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => openHistoryDialog(bill)}
                          title="Transaction History"
                        >
                          <Clock className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Purchase Bill?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(bill.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredBills.length > pageSize && (
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
        </div>
      )}

      {/* Image View Dialog */}
      <Dialog
        open={!!viewImageBill}
        onOpenChange={() => setViewImageBill(null)}
      >
        <DialogContent
          className="w-[100vw] sm:w-[90vw] lg:w-[85vw] max-w-4xl
          h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh]
          left-0 top-0 translate-x-0 translate-y-0
          sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-lg
          p-0 flex flex-col gap-0"
        >
          <DialogHeader className="px-6 sm:px-8 py-5 border-b shrink-0 bg-background sticky top-0 z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
            <DialogTitle>Original Bill Image</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
            {viewImageBill && (
              <img
                src={viewImageBill.billImage}
                alt="Bill"
                className="w-full rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      {/* Detail View Dialog */}
      <Dialog
        open={!!selectedBill}
        onOpenChange={() => {
          setSelectedBill(null);
          setIsEditing(false);
          setEditedBill(null);
        }}
      >
        <DialogContent
          className="w-[100vw] sm:w-[90vw] lg:w-[85vw] xl:w-[80vw] max-w-[1800px]
          h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh]
          left-0 top-0 translate-x-0 translate-y-0
          sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          rounded-none sm:rounded-lg
          p-0 flex flex-col gap-0"
        >
          {/* Fixed Header */}
          <DialogHeader className="px-6 sm:px-10 py-6 border-b shrink-0 bg-background sticky top-0 z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
            <DialogTitle className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <span className="text-2xl lg:text-4xl font-bold">
                Extracted Bill Details
              </span>
              {selectedBill && !isEditing && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => startEditing(selectedBill)}
                >
                  <Edit2 className="h-5 w-5 mr-2" /> Edit
                </Button>
              )}
              {isEditing && (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedBill(null);
                    }}
                  >
                    <X className="h-5 w-5 mr-2" /> Cancel
                  </Button>
                  <Button
                    size="lg"
                    onClick={saveEditedBill}
                    disabled={savingEditedBill}
                  >
                    {savingEditedBill ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />{" "}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" /> Save
                      </>
                    )}
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
            {/* Extraction Errors Alert */}
            {selectedBill?.extractionErrors &&
              selectedBill.extractionErrors.length > 0 &&
              !isEditing && (
                <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/20 mb-8">
                  <CardContent className="py-6">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-7 w-7 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-3 flex-1">
                        <p className="font-semibold text-lg text-amber-800 dark:text-amber-200">
                          AI detected potential issues:
                        </p>
                        <ul className="space-y-3 text-amber-700 dark:text-amber-300">
                          {selectedBill.extractionErrors.map((error, i) => (
                            <li
                              key={i}
                              className="flex flex-col lg:flex-row lg:items-start gap-3"
                            >
                              <span
                                className={`px-2 py-1 rounded text-sm font-medium ${
                                  error.severity === "error"
                                    ? "bg-destructive/20 text-destructive"
                                    : "bg-amber-200 text-amber-800"
                                }`}
                              >
                                {error.severity.toUpperCase()}
                              </span>
                              <div className="flex-1">
                                <span className="block text-base">
                                  {error.message}
                                </span>
                                {error.suggestion && (
                                  <span className="block text-sm text-amber-600 mt-1">
                                    Suggestion: {error.suggestion}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          size="lg"
                          className="mt-4 border-amber-400 text-amber-700"
                          onClick={() => startEditing(selectedBill)}
                        >
                          <Edit2 className="h-5 w-5 mr-2" /> Fix Issues
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            {(isEditing ? editedBill : selectedBill) && (
              <div className="space-y-10">
                {/* Vendor Information */}
                <Card className="overflow-hidden shadow-sm">
                  <CardHeader className="bg-muted/40 px-6 py-5">
                    <CardTitle className="text-2xl lg:text-3xl">
                      Vendor Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-8 px-6 pb-8">
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label className="text-base">Vendor Name</Label>
                          <Input
                            value={editedBill?.vendorName || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev ? { ...prev, vendorName: e.target.value } : null
                              )
                            }
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">GSTIN</Label>
                          <Input
                            value={editedBill?.vendorGstin || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      vendorGstin: e.target.value.toUpperCase(),
                                    }
                                  : null
                              )
                            }
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Bill Number</Label>
                          <Input
                            value={editedBill?.billNumber || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev
                                  ? { ...prev, billNumber: e.target.value }
                                  : null
                              )
                            }
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Bill Date</Label>
                          <Input
                            type="date"
                            value={editedBill?.billDate || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev
                                  ? { ...prev, billDate: e.target.value }
                                  : null
                              )
                            }
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">Due Date</Label>
                          <Input
                            type="date"
                            value={editedBill?.dueDate || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev
                                  ? { ...prev, dueDate: e.target.value }
                                  : null
                              )
                            }
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base">
                            Payment Terms (Days)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={editedBill?.paymentTerms || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      paymentTerms:
                                        parseInt(e.target.value) || 0,
                                    }
                                  : null
                              )
                            }
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2 xl:col-span-3">
                          <Label className="text-base">Address</Label>
                          <Textarea
                            value={editedBill?.vendorAddress || ""}
                            onChange={(e) =>
                              setEditedBill((prev) =>
                                prev
                                  ? { ...prev, vendorAddress: e.target.value }
                                  : null
                              )
                            }
                            rows={4}
                            className="resize-none text-base"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-base lg:text-lg">
                        <div className="space-y-6">
                          <div>
                            <span className="text-muted-foreground">
                              Vendor Name:
                            </span>
                            <p className="font-bold text-2xl lg:text-3xl mt-2 break-words">
                              {selectedBill?.vendorName}
                            </p>
                          </div>
                          {selectedBill?.vendorAddress && (
                            <div>
                              <span className="text-muted-foreground">
                                Address:
                              </span>
                              <p className="mt-2 whitespace-pre-line break-words">
                                {selectedBill.vendorAddress}
                              </p>
                            </div>
                          )}
                          {selectedBill?.vendorGstin && (
                            <div>
                              <span className="text-muted-foreground">
                                GSTIN:
                              </span>
                              <p className="mt-2 font-medium break-all">
                                {selectedBill.vendorGstin}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-6">
                          <div>
                            <span className="text-muted-foreground">
                              Bill No:
                            </span>
                            <p className="mt-2 font-semibold text-xl lg:text-2xl">
                              {selectedBill?.billNumber || "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Bill Date:
                            </span>
                            <p className="mt-2">
                              {formatDate(selectedBill?.billDate)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Due Date:
                            </span>
                            <p
                              className={`mt-2 font-medium ${
                                isOverdue(selectedBill)
                                  ? "text-destructive"
                                  : ""
                              }`}
                            >
                              {formatDate(selectedBill?.dueDate)}{" "}
                              {selectedBill?.paymentTerms
                                ? `(${selectedBill.paymentTerms} days)`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment History */}
                <Card className="overflow-hidden shadow-sm">
                  <CardHeader className="bg-muted/40 px-6 py-5">
                    <CardTitle className="text-2xl lg:text-3xl flex items-center justify-between">
                      <span>Payment History</span>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={
                            (isEditing ? editedBill : selectedBill)?.paymentStatus === "paid"
                              ? "default"
                              : "secondary"
                          }
                          className="text-lg py-1 px-4"
                        >
                          {(isEditing ? editedBill : selectedBill)?.paymentStatus.toUpperCase()}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-8 px-6 pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      <div className="space-y-2 p-4 bg-muted/20 rounded-lg border">
                        <span className="text-muted-foreground text-sm uppercase tracking-wider font-semibold">Total Amount</span>
                        <p className="text-3xl font-bold text-foreground">
                          {formatCurrency((isEditing ? editedBill : selectedBill)?.total || 0)}
                        </p>
                      </div>
                      <div className="space-y-2 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900">
                        <span className="text-emerald-700 dark:text-emerald-300 text-sm uppercase tracking-wider font-semibold">Total Paid</span>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency((isEditing ? editedBill : selectedBill)?.paidAmount || 0)}
                        </p>
                      </div>
                      <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900">
                        <span className="text-blue-700 dark:text-blue-300 text-sm uppercase tracking-wider font-semibold">Payment Breakdown</span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Object.entries(
                            (isEditing ? editedBill : selectedBill)?.payments?.reduce((acc, p) => {
                              acc[p.method] = (acc[p.method] || 0) + p.amount;
                              return acc;
                            }, {} as Record<string, number>) || {}
                          ).map(([method, amount]) => (
                            <Badge key={method} variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-none">
                              {method}: {formatCurrency(amount)}
                            </Badge>
                          ))}
                          {((isEditing ? editedBill : selectedBill)?.payments?.length || 0) === 0 && (
                            <span className="text-sm text-muted-foreground italic">No payments yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {((isEditing ? editedBill : selectedBill)?.payments?.length || 0) > 0 ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm lg:text-base">
                          <thead className="bg-muted/60">
                            <tr>
                              <th className="text-left px-6 py-4 font-semibold">Date</th>
                              <th className="text-left px-6 py-4 font-semibold">Method</th>
                              <th className="text-right px-6 py-4 font-semibold">Amount</th>
                              <th className="text-left px-6 py-4 font-semibold">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(isEditing ? editedBill : selectedBill)?.payments?.map((payment, i) => (
                              <tr key={payment.id || i} className="border-t">
                                <td className="px-6 py-4">{formatDate(payment.date)}</td>
                                <td className="px-6 py-4">
                                  <Badge variant="outline">{payment.method}</Badge>
                                </td>
                                <td className="px-6 py-4 text-right font-bold">{formatCurrency(payment.amount)}</td>
                                <td className="px-6 py-4 text-muted-foreground">{payment.note || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-muted/10 rounded-lg border border-dashed">
                        <p className="text-muted-foreground">No payments recorded yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Items Table */}
                <Card className="overflow-hidden shadow-sm">
                  <CardHeader className="bg-muted/40 px-6 py-5">
                    <CardTitle className="text-2xl lg:text-3xl flex items-center justify-between">
                      <span>Items</span>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-normal text-muted-foreground">
                          {
                            (isEditing ? editedBill?.items : selectedBill?.items)
                              .length
                          }{" "}
                          item(s)
                        </span>
                        {isEditing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addEditedItemRow}
                          >
                            <PackagePlus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm lg:text-lg">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-left px-6 py-4 font-semibold sticky left-0 bg-muted/60">
                              #
                            </th>
                            <th className="text-left px-6 py-4 font-semibold min-w-[300px]">
                              Description
                            </th>
                            <th className="text-center px-6 py-4 font-semibold">
                              HSN
                            </th>
                            <th className="text-right px-6 py-4 font-semibold">
                              Qty
                            </th>
                            <th className="text-right px-6 py-4 font-semibold">
                              Rate
                            </th>
                            <th className="text-right px-6 py-4 font-semibold">
                              GST%
                            </th>
                            <th className="text-right px-6 py-4 font-semibold">
                              Amount
                            </th>
                            {isEditing && (
                              <th className="text-right px-6 py-4 font-semibold">
                                Actions
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(isEditing
                            ? editedBill?.items
                            : selectedBill?.items
                          )?.map((item, index) => (
                            <tr
                              key={index}
                              className={`border-t ${
                                item.hasError
                                  ? "bg-amber-50 dark:bg-amber-900/20"
                                  : ""
                              }`}
                            >
                              <td className="px-6 py-4 font-medium sticky left-0 bg-background">
                                {index + 1}
                              </td>
                              <td className="px-6 py-4 max-w-md">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Input
                                      value={item.description}
                                      onChange={(e) =>
                                        updateEditedItem(
                                          index,
                                          "description",
                                          e.target.value
                                        )
                                      }
                                      className="h-11 text-base"
                                      placeholder="Item / Product name"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <Input
                                        value={(item as any).whereToBuy || ""}
                                        onChange={(e) =>
                                          updateEditedItem(
                                            index,
                                            "whereToBuy" as any,
                                            e.target.value
                                          )
                                        }
                                        className="h-10 text-base"
                                        placeholder="Bought from (optional)"
                                      />
                                      <Input
                                        value={(item as any).weight || ""}
                                        onChange={(e) =>
                                          updateEditedItem(
                                            index,
                                            "weight" as any,
                                            e.target.value
                                          )
                                        }
                                        className="h-10 text-base"
                                        placeholder="Weight (optional)"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="font-medium break-words">
                                      {item.description}
                                    </div>
                                    {(item as any).whereToBuy && (
                                      <div className="text-sm text-muted-foreground mt-1">
                                        Bought from: {(item as any).whereToBuy}
                                      </div>
                                    )}
                                    {(item as any).weight && (
                                      <div className="text-sm text-muted-foreground">
                                        Weight: {(item as any).weight}
                                      </div>
                                    )}
                                    {item.hasError && (
                                      <p className="text-sm text-amber-600 mt-1">
                                        {item.errorMessage}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {isEditing ? (
                                  <Input
                                    value={item.hsnCode || ""}
                                    onChange={(e) =>
                                      updateEditedItem(
                                        index,
                                        "hsnCode",
                                        e.target.value
                                      )
                                    }
                                    className="h-11 w-32 mx-auto text-base"
                                  />
                                ) : (
                                  item.hsnCode || "—"
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-3">
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateEditedItem(
                                          index,
                                          "quantity",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="h-11 w-28 text-right text-base"
                                    />
                                    <Input
                                      value={item.unit}
                                      onChange={(e) =>
                                        updateEditedItem(
                                          index,
                                          "unit",
                                          e.target.value
                                        )
                                      }
                                      className="h-11 w-24 text-base"
                                    />
                                  </div>
                                ) : (
                                  <span className="font-medium">
                                    {item.quantity} {item.unit}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.rate}
                                    onChange={(e) =>
                                      updateEditedItem(
                                        index,
                                        "rate",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="h-11 w-36 text-right text-base"
                                  />
                                ) : (
                                  formatCurrency(item.rate)
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={item.gstRate || 0}
                                    onChange={(e) =>
                                      updateEditedItem(
                                        index,
                                        "gstRate",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="h-11 w-28 text-right text-base"
                                  />
                                ) : (
                                  <span className="font-medium">
                                    {item.gstRate || 0}%
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-bold">
                                {formatCurrency(item.amount)}
                              </td>
                              {isEditing && (
                                <td className="px-6 py-4 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeEditedItemRow(index)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Totals Summary */}
                <Card className="shadow-sm">
                  <CardHeader className="bg-muted/40 px-6 py-5">
                    <CardTitle className="text-2xl lg:text-3xl">
                      Bill Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-8 px-6 pb-8">
                    <div className="max-w-lg ml-auto space-y-5">
                      <div className="flex justify-between text-lg lg:text-2xl">
                        <span>Subtotal</span>
                        <span className="font-bold">
                          {formatCurrency(
                            isEditing
                              ? editedBill?.items.reduce(
                                  (sum, item) => sum + item.amount,
                                  0
                                ) || 0
                              : selectedBill?.subtotal || 0
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg lg:text-2xl">
                        <span>Tax Amount</span>
                        <span className="font-bold">
                          {formatCurrency(
                            isEditing
                              ? editedBill?.items.reduce(
                                  (sum, item) => sum + (item.gstAmount || 0),
                                  0
                                ) || 0
                              : selectedBill?.totalTax || 0
                          )}
                        </span>
                      </div>
                      <div className="border-t-4 border-primary pt-6 space-y-4">
                        <div className="flex justify-between text-xl lg:text-3xl text-muted-foreground">
                          <span>Original Bill Amount</span>
                          <span className="font-semibold decoration-red-500/50">
                            {formatCurrency(
                              isEditing
                                ? (editedBill?.items.reduce(
                                    (sum, item) => sum + item.amount,
                                    0
                                  ) || 0) +
                                    (editedBill?.items.reduce(
                                      (sum, item) =>
                                        sum + (item.gstAmount || 0),
                                      0
                                    ) || 0)
                                : selectedBill?.total || 0
                            )}
                          </span>
                        </div>
                        {selectedBill?.returns && selectedBill.returns.length > 0 && (
                          <div className="flex justify-between text-xl lg:text-3xl text-red-600">
                            <span>- Returns</span>
                            <span className="font-semibold">
                              {formatCurrency(
                                selectedBill.returns.reduce(
                                  (sum, r) => sum + r.totalReturnValue,
                                  0
                                )
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-2xl lg:text-4xl">
                          <span className="font-bold">Current Total</span>
                          <span className="font-bold text-primary">
                            {formatCurrency(
                              (isEditing
                                ? (editedBill?.items.reduce(
                                    (sum, item) => sum + item.amount,
                                    0
                                  ) || 0) +
                                    (editedBill?.items.reduce(
                                      (sum, item) =>
                                        sum + (item.gstAmount || 0),
                                      0
                                    ) || 0)
                                : selectedBill?.total || 0) -
                                (selectedBill?.returns?.reduce(
                                  (sum, r) => sum + r.totalReturnValue,
                                  0
                                ) || 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </div>
          {/* Sticky footer actions (always visible on mobile) */}
          {!isEditing && selectedBill && (
            <div className="shrink-0 border-t bg-background px-6 sm:px-10 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="flex flex-col lg:flex-row gap-4 justify-end">
                {!selectedBill.itemsAddedToInventory ? (
                  <Button
                    onClick={() => handleAddToInventory(selectedBill)}
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <PackagePlus className="h-6 w-6 mr-3" />
                    Add to Inventory
                  </Button>
                ) : (
                  <Badge variant="secondary" className="py-3 px-6 text-lg">
                    <PackagePlus className="h-6 w-6 mr-3" />
                    Added to Inventory
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setViewImageBill(selectedBill)}
                >
                  <Image className="h-6 w-6 mr-3" />
                  View Original Bill
                </Button>
                <Button
                  size="lg"
                  variant={
                    selectedBill.paymentStatus === "paid"
                      ? "secondary"
                      : "default"
                  }
                  onClick={() => {
                    handleTogglePayment(selectedBill);
                    setSelectedBill({
                      ...selectedBill,
                      paymentStatus:
                        selectedBill.paymentStatus === "paid"
                          ? "pending"
                          : "paid",
                    });
                  }}
                >
                  {selectedBill.paymentStatus === "paid"
                    ? "Mark as Pending"
                    : "Mark as Paid"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog - Enter Selling Prices */}
      <Dialog
        open={!!inventoryDialogBill}
        onOpenChange={(open) => !open && setInventoryDialogBill(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-emerald-600" />
              Add to Inventory - Set Selling Prices
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {lastInventoryError && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">Inventory error details</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(lastInventoryError);
                          toast({
                            title: "Copied",
                            description: "Error details copied to clipboard",
                          });
                        } catch {
                          toast({
                            title: "Copy failed",
                            description:
                              "Could not copy automatically. Please screenshot this section.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Copy
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLastInventoryError(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                  {lastInventoryError}
                </pre>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Enter the selling price for each item. Purchase price is shown for
              reference.
            </p>

            <div className="space-y-3">
              {inventoryItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} {item.unit} | HSN:{" "}
                        {item.hsnCode || "N/A"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      GST: {item.gstRate}%
                    </Badge>
                  </div>
                  
                          {/* Matching Option */}
                          <div className="mt-2 p-2 bg-background/50 rounded-md border border-dashed">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 px-1">Inventory Action</p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={item.isNewProduct ? "default" : "outline"}
                                size="sm"
                                className="flex-1 h-8 text-xs py-0"
                                onClick={() => {
                                  const newItems = [...inventoryItems];
                                  newItems[index].isNewProduct = true;
                                  setInventoryItems(newItems);
                                }}
                              >
                                Create New
                              </Button>
                              <Button
                                type="button"
                                variant={!item.isNewProduct ? "default" : "outline"}
                                size="sm"
                                className="flex-1 h-8 text-xs py-0"
                                onClick={() => {
                                  const newItems = [...inventoryItems];
                                  newItems[index].isNewProduct = false;
                                  setInventoryItems(newItems);
                                }}
                              >
                                Update Stock
                              </Button>
                            </div>
                            
                            {/* Product Selector for Update Stock */}
                            {!item.isNewProduct && (
                              <div className="mt-2 space-y-1">
                                <Label className="text-[10px] px-1">Selected Product</Label>
                                <Select 
                                  value={item.productId || ""} 
                                  onValueChange={(val) => {
                                    const newItems = [...inventoryItems];
                                    newItems[index].productId = val;
                                    const selectedProduct = products.find(p => p.id === val);
                                    if (selectedProduct) {
                                      newItems[index].hsnCode = selectedProduct.hsnCode || "";
                                    }
                                    setInventoryItems(newItems);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select Product" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map(p => (
                                      <SelectItem key={p.id} value={p.id} className="text-xs">
                                        {p.name} (₹{p.sellingPrice})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {!item.productId && !item.isNewProduct && (
                              <p className="text-[10px] text-amber-600 mt-1 px-1">No matching product found by name/HSN. Please select one manually.</p>
                            )}
                          </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Purchase Price
                      </Label>
                      <div className="text-sm font-medium bg-muted px-3 py-2 rounded">
                        ₹{item.purchasePrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Selling Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.sellingPrice}
                        onChange={(e) =>
                          updateInventoryItemSellingPrice(
                            index,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                  {item.sellingPrice > 0 && (
                    <p className="text-xs text-emerald-600 mt-2">
                      Margin: ₹
                      {(item.sellingPrice - item.purchasePrice).toFixed(2)}(
                      {(
                        ((item.sellingPrice - item.purchasePrice) /
                          item.purchasePrice) *
                        100
                      ).toFixed(1)}
                      %)
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setInventoryDialogBill(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => confirmAddToInventory()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <PackagePlus className="h-4 w-4 mr-2" />
                Add to Inventory
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConflictResolutionDialog
        conflicts={productConflicts}
        onResolve={handleConflictResolution}
        onCancel={handleConflictCancel}
      />
      {selectedBillForPayment && (
        <PaymentDialog
          bill={selectedBillForPayment as any}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          onPaymentCollected={handlePaymentCollected}
        />
      )}
      <PurchaseReturnForm
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open);
          if (!open) setEditingReturn(null);
        }}
        bill={selectedBillForReturn!}
        onSuccess={loadBills}
        editReturn={editingReturn}
      />
      {/* Transaction History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onOpenChange={(open) => !open && setHistoryDialogOpen(false)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Transaction History
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
            {selectedBillForHistory && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Vendor</p>
                    <p className="font-bold">{selectedBillForHistory.vendorName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Bill No</p>
                    <p className="font-bold">#{selectedBillForHistory.billNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Original Amount</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedBillForHistory.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Current Total (after returns)</p>
                    <p className="font-bold text-lg text-blue-600">
                      {formatCurrency(selectedBillForHistory.total - (selectedBillForHistory.returns?.reduce((sum, r) => sum + r.totalReturnValue, 0) || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Paid Amount</p>
                    <p className="font-bold text-lg text-emerald-600">{formatCurrency(selectedBillForHistory.paidAmount)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Timeline
                  </h4>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold">Date</th>
                          <th className="text-left p-3 font-semibold">Type</th>
                          <th className="text-left p-3 font-semibold">Description</th>
                          <th className="text-right p-3 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {getPurchaseHistory(selectedBillForHistory).map((entry: any) => (
                          <tr key={entry.id} className="group hover:bg-muted/50 transition-colors">
                            <td className="p-3">{formatDate(entry.date)}</td>
                            <td className="p-3">
                              <Badge variant="outline" className={
                                entry.type === 'purchase' ? 'bg-red-50 text-red-700 border-red-200' :
                                entry.type === 'payment' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                              }>
                                {entry.type.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {editingTransaction?.id === entry.id ? (
                                <div className="flex gap-2 items-center">
                                  <Input 
                                    type="number" 
                                    value={transactionAmount} 
                                    onChange={(e) => setTransactionAmount(e.target.value)}
                                    className="h-8 w-24"
                                  />
                                  <Button size="sm" onClick={saveEditedTransaction} className="h-8">Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingTransaction(null)} className="h-8">Cancel</Button>
                                </div>
                              ) : (
                                <span>{entry.description}</span>
                              )}
                            </td>
                            <td className={`p-3 text-right font-bold ${entry.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatCurrency(entry.amount)}
                            </td>
                            <td className="p-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              {entry.type !== 'purchase' && (
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditTransaction(entry)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will remove the {entry.type} record and update the bill balance accordingly.
                                          {entry.type === 'return' && " Stock will be reverted to inventory."}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTransaction(entry)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
