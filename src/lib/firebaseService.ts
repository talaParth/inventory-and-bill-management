import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import {
  CompanyProfile,
  Client,
  Product,
  Bill,
  InventoryTransaction,
  PurchaseBill,
  BillReturn,
  DeadstockItem,
  Expense,
  UploadedFile,
  Note,
  InventoryAddResult,
  ProductConflict,
  SampleBill,
  PaymentMethod,
  PaymentTransaction,
} from "@/types";

// Collection names
const COLLECTIONS = {
  COMPANY: "company",
  CLIENTS: "clients",
  PRODUCTS: "products",
  BILLS: "bills",
  INVENTORY: "inventory",
  BILL_COUNTER: "counters",
  PURCHASE_BILLS: "purchaseBills",
  BILL_RETURNS: "billReturns",
  DEADSTOCK: "deadstock",
  USER_PREFERENCES: "userPreferences",
  EXPENSES: "expenses",
  FILES: "files",
  NOTES: "notes",
  SAMPLE_BILLS: "sampleBills",
  CUSTOMERS: "customers",
  COUNTERS: "counters",
  PURCHASE_RETURNS: "purchaseReturns",
};

// Helper function to get user ID (for multi-user support in future)
const getUserId = (): string => {
  // For now, using a default user ID. In future, this can be from auth.currentUser
  return "default";
};

// Helper function to remove undefined values from objects (Firestore doesn't support undefined)
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

// Company Profile
export const getCompanyProfile = async (): Promise<CompanyProfile | null> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.COMPANY, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as CompanyProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting company profile:", error);
    return null;
  }
};

export const saveCompanyProfile = async (
  profile: CompanyProfile
): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.COMPANY, userId);
    const cleanedData = removeUndefined(profile);
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving company profile:", error);
    throw error;
  }
};

// Clients
export const getClients = async (): Promise<Client[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.CLIENTS),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const clients = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        billingAddress: data.billingAddress || data.address || "",
        shippingAddress: data.shippingAddress || "",
      } as Client;
    });

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return clients.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting clients:", error);
    return [];
  }
};

export const saveClient = async (client: Client): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.CLIENTS, client.id);
    const cleanedData = removeUndefined({ ...client, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving client:", error);
    throw error;
  }
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CLIENTS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
};

// Products
export const getProducts = async (): Promise<Product[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const products = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        purchasePrice: data.purchasePrice || 0,
        sellingPrice: data.sellingPrice || data.price || 0,
      } as Product;
    });

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return products.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting products:", error);
    return [];
  }
};

export const saveProduct = async (product: Product): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
    const cleanedData = removeUndefined({ ...product, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PRODUCTS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
};

export const updateProductStock = async (
  productId: string,
  quantity: number,
  type: "sale" | "return"
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const product = docSnap.data() as Product;
      let newStock: number;

      if (type === "sale") {
        newStock = Math.max(0, product.stock - quantity);
      } else {
        newStock = product.stock + quantity;
      }

      // Round to 2 decimal places
      newStock = Math.round(newStock * 100) / 100;

      await updateDoc(docRef, { stock: newStock });
    }
  } catch (error) {
    console.error("Error updating product stock:", error);
    throw error;
  }
};

// Bills
export const getBills = async (): Promise<Bill[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.BILLS),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const bills = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        client: {
          ...data.client,
          billingAddress:
            data.client.billingAddress || data.client.address || "",
          shippingAddress: data.client.shippingAddress || "",
        },
      } as Bill;
    });

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return bills.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting bills:", error);
    return [];
  }
};

export const saveBill = async (bill: Bill): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // Check if this is an update by trying to fetch the existing bill
    const billRef = doc(db, COLLECTIONS.BILLS, bill.id);
    const existingBillSnap = await getDoc(billRef);
    const isUpdate = existingBillSnap.exists();

    let existingBill: Bill | null = null;
    if (isUpdate) {
      existingBill = existingBillSnap.data() as Bill;
    }

    // Calculate stock adjustments needed
    const stockAdjustments = new Map<string, number>();

    if (isUpdate && existingBill) {
      // For updates, calculate the difference between old and new quantities

      // First, restore stock from original items
      for (const oldItem of existingBill.items) {
        const currentAdjustment = stockAdjustments.get(oldItem.productId) || 0;
        stockAdjustments.set(
          oldItem.productId,
          currentAdjustment + oldItem.quantity
        );
      }

      // Then, deduct stock for new items
      for (const newItem of bill.items) {
        const currentAdjustment = stockAdjustments.get(newItem.productId) || 0;
        stockAdjustments.set(
          newItem.productId,
          currentAdjustment - newItem.quantity
        );
      }
    } else {
      // For new bills, deduct full quantities
      for (const item of bill.items) {
        stockAdjustments.set(item.productId, -item.quantity);
      }
    }

    // Validate stock availability for all adjustments
    for (const [productId, adjustment] of stockAdjustments.entries()) {
      if (adjustment < 0) {
        // Only validate if we need to deduct stock (negative adjustment)
        const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          const requiredStock = Math.abs(adjustment);

          if (product.stock < requiredStock) {
            const productName =
              bill.items.find((i) => i.productId === productId)?.productName ||
              "Unknown";
            throw new Error(
              `Insufficient stock for ${productName}. Available: ${product.stock.toFixed(
                2
              )}, Required: ${requiredStock.toFixed(2)}`
            );
          }
        } else {
          throw new Error(`Product not found: ${productId}`);
        }
      }
    }

    // Save bill
    const cleanedBillData = removeUndefined({ ...bill, userId });
    batch.set(billRef, cleanedBillData, { merge: true });

    // Apply stock adjustments
    for (const [productId, adjustment] of stockAdjustments.entries()) {
      if (adjustment !== 0) {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          const newStock = Math.max(0, product.stock + adjustment); // adjustment is negative for deduction
          batch.update(productRef, { stock: newStock });
        }
      }
    }

    // Handle inventory transactions
    if (isUpdate && existingBill) {
      // Delete old inventory transactions for this bill
      const oldTransactionsQuery = query(
        collection(db, COLLECTIONS.INVENTORY),
        where("billId", "==", bill.id)
      );
      const oldTransactionsSnap = await getDocs(oldTransactionsQuery);

      oldTransactionsSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }

    // Create new inventory transaction records
    for (const item of bill.items) {
      const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
      const transaction = {
        id: transactionRef.id,
        productId: item.productId,
        billId: bill.id,
        type: "sale" as const,
        quantity: item.quantity,
        date: bill.date,
        userId,
      };
      batch.set(transactionRef, transaction);
    }

    // Ensure payments array exists for new bills
    if (!bill.payments) {
      bill.payments = [];
    }

    await batch.commit();
  } catch (error) {
    console.error("Error saving bill:", error);
    throw error;
  }
};

export const deleteBill = async (id: string): Promise<void> => {
  try {
    const userId = getUserId();
    const billRef = doc(db, COLLECTIONS.BILLS, id);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = billSnap.data() as Bill;
      const batch = writeBatch(db);

      // Delete bill
      batch.delete(billRef);

      // Return items to inventory
      for (const item of bill.items) {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, item.productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          const newStock = product.stock + item.quantity;
          batch.update(productRef, { stock: newStock });
        }
      }

      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting bill:", error);
    throw error;
  }
};

export const getBillCounter = async (): Promise<number> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.BILL_COUNTER, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().counter || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error getting bill counter:", error);
    return 0;
  }
};

export const incrementBillCounter = async (): Promise<number> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.BILL_COUNTER, userId);
    const docSnap = await getDoc(docRef);

    const currentCounter = docSnap.exists() ? docSnap.data().counter || 0 : 0;
    const newCounter = currentCounter + 1;

    const cleanedData = removeUndefined({ counter: newCounter, userId });
    await setDoc(docRef, cleanedData, { merge: true });
    return newCounter;
  } catch (error) {
    console.error("Error incrementing bill counter:", error);
    throw error;
  }
};

export const updateBillPayment = async (
  billId: string,
  paidAmount: number,
  paymentType: PaymentMethod,
  note?: string
): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = billSnap.data() as Bill;
      const newPaidAmount = (bill.paidAmount || 0) + paidAmount;
      const paymentStatus =
        newPaidAmount >= bill.total ? "paid" : bill.paymentStatus;

      const newPayment: PaymentTransaction = {
        id: Math.random().toString(36).substr(2, 9),
        amount: paidAmount,
        method: paymentType,
        date: new Date().toISOString(),
        note: note,
      };

      const payments = Array.isArray(bill.payments) ? [...bill.payments, newPayment] : [newPayment];

      await updateDoc(billRef, {
        paidAmount: newPaidAmount,
        paymentStatus,
        paymentType: paymentType, // Update main payment type to last used
        payments: removeUndefined(payments),
      });
    }
  } catch (error) {
    console.error("Error updating bill payment:", error);
    throw error;
  }
};

// Inventory Transactions
export const getInventoryTransactions = async (): Promise<
  InventoryTransaction[]
> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.INVENTORY),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const transactions = querySnapshot.docs.map(
      (doc) => doc.data() as InventoryTransaction
    );

    // Sort by date descending in JavaScript (avoids index requirement)
    return transactions.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting inventory transactions:", error);
    return [];
  }
};

export const saveInventoryTransaction = async (
  transaction: InventoryTransaction
): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.INVENTORY, transaction.id);
    const cleanedData = removeUndefined({ ...transaction, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving inventory transaction:", error);
    throw error;
  }
};

// Add stock to a product with transaction tracking
export const addStockToProduct = async (
  productId: string,
  quantity: number,
  purchasePrice: number
): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // Get the product
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      throw new Error("Product not found");
    }

    const product = productSnap.data() as Product;
    const newStock = product.stock + quantity;
    const roundedStock = Math.round(newStock * 100) / 100;

    // Update product stock
    batch.update(productRef, { stock: roundedStock });

    // Create inventory transaction
    const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
    const transaction: InventoryTransaction = {
      id: transactionRef.id,
      productId,
      type: "purchase",
      quantity,
      date: new Date().toISOString(),
      purchasePrice,
      userId,
    };
    const cleanedTransactionData = removeUndefined(transaction);
    batch.set(transactionRef, cleanedTransactionData);

    await batch.commit();
  } catch (error) {
    console.error("Error adding stock to product:", error);
    throw error;
  }
};

// Get inventory transactions for a specific product
export const getProductTransactions = async (
  productId: string
): Promise<InventoryTransaction[]> => {
  try {
    const transactions = await getInventoryTransactions();
    return transactions.filter(
      (t) => t.productId === productId && t.type === "purchase"
    );
  } catch (error) {
    console.error("Error getting product transactions:", error);
    return [];
  }
};

// Purchase Bills
export const getPurchaseBills = async (): Promise<PurchaseBill[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.PURCHASE_BILLS),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const bills = querySnapshot.docs.map((doc) => doc.data() as PurchaseBill);

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return bills.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting purchase bills:", error);
    return [];
  }
};

export const savePurchaseBill = async (bill: PurchaseBill): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
    const cleanedData = removeUndefined({ ...bill, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving purchase bill:", error);
    throw error;
  }
};

export const deletePurchaseBill = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_BILLS, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting purchase bill:", error);
    throw error;
  }
};

export const updatePurchaseBillPayment = async (
  billId: string,
  paidAmount: number,
  paymentType: PaymentMethod,
  note?: string
): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = billSnap.data() as PurchaseBill;
      const newPaidAmount = (bill.paidAmount || 0) + paidAmount;
      const paymentStatus =
        newPaidAmount >= bill.total ? "paid" : bill.paymentStatus;

      const newPayment: PaymentTransaction = {
        id: Math.random().toString(36).substr(2, 9),
        amount: paidAmount,
        method: paymentType,
        date: new Date().toISOString(),
        note: note,
      };

      const payments = Array.isArray(bill.payments) ? [...bill.payments, newPayment] : [newPayment];

      await updateDoc(billRef, {
        paidAmount: newPaidAmount,
        paymentStatus,
        payments: removeUndefined(payments),
      });
    }
  } catch (error) {
    console.error("Error updating purchase bill payment:", error);
    throw error;
  }
};

// Purchase Returns
export const savePurchaseReturn = async (
  returnOrder: PurchaseReturn,
  adjustStock: boolean = true
): Promise<void> => {
  try {
    const userId = getUserId();
    const batch = writeBatch(db);

    // 1. Save the return record
    const returnRef = doc(db, COLLECTIONS.PURCHASE_RETURNS, returnOrder.id);
    batch.set(returnRef, removeUndefined({ ...returnOrder, userId }));

    // 2. Update the Purchase Bill
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, returnOrder.purchaseBillId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = billSnap.data() as PurchaseBill;
      const currentReturns = bill.returns || [];
      const updatedReturns = [...currentReturns, returnOrder];
      
      // Calculate new totals
      const newTotal = (bill.total || 0) - returnOrder.totalReturnValue;
      const newPaymentStatus = (bill.paidAmount || 0) >= newTotal ? "paid" : bill.paymentStatus;

      batch.update(billRef, {
        returns: removeUndefined(updatedReturns),
        total: newTotal,
        paymentStatus: newPaymentStatus,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. Adjust Stock if requested
    if (adjustStock) {
      for (const item of returnOrder.items) {
        // Find product by description and update stock
        const productsQuery = query(
          collection(db, COLLECTIONS.PRODUCTS),
          where("userId", "==", userId)
        );
        const productsSnap = await getDocs(productsQuery);
        const productDoc = productsSnap.docs.find(d => 
          (d.data().name as string).toLowerCase() === item.description.toLowerCase()
        );
        
        if (productDoc) {
          const productRef = productDoc.ref;
          const currentStock = productDoc.data().stock || 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          batch.update(productRef, { stock: Math.round(newStock * 100) / 100 });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    console.error("Error saving purchase return:", error);
    throw error;
  }
};

export const addPurchaseItemsToInventory = async (
  bill: PurchaseBill,
  itemsWithSellingPrice: InventoryItemInput[],
  conflictResolutions?: Map<string, string> // HSN -> chosen name
): Promise<InventoryAddResult> => {
  try {
    const userId = getUserId();
    const products = await getProducts();
    const batch = writeBatch(db);

    let added = 0;
    let updated = 0;
    const conflicts: ProductConflict[] = [];

    for (const item of itemsWithSellingPrice) {
      // Skip if no HSN code provided
      if (!item.hsnCode) {
        // Handle items without HSN code - match by name only
        const existingProduct = products.find(
          (p) => p.name.toLowerCase() === item.description.toLowerCase()
        );

        if (existingProduct) {
          await updateExistingProduct(
            existingProduct,
            item,
            bill,
            batch,
            userId
          );
          updated++;
        } else {
          await createNewProduct(item, bill, batch, userId);
          added++;
        }
        continue;
      }

      // Find products with same HSN code
      const productsWithSameHSN = products.filter(
        (p) => p.hsnCode && p.hsnCode === item.hsnCode
      );

      if (productsWithSameHSN.length === 0) {
        // No existing product with this HSN - create new
        await createNewProduct(item, bill, batch, userId);
        added++;
        continue;
      }

      // Check for exact match (HSN + Name)
      const exactMatch = productsWithSameHSN.find(
        (p) => p.name.toLowerCase() === item.description.toLowerCase()
      );

      if (exactMatch) {
        // Perfect match - update stock
        await updateExistingProduct(exactMatch, item, bill, batch, userId);
        updated++;
        continue;
      }

      // HSN exists but name is different - check if we have a resolution
      if (conflictResolutions && conflictResolutions.has(item.hsnCode)) {
        const chosenName = conflictResolutions.get(item.hsnCode)!;
        const productToUpdate =
          productsWithSameHSN.find((p) => p.name === chosenName) ||
          productsWithSameHSN[0];

        // Update the product with chosen name
        await updateExistingProductWithNameChange(
          productToUpdate,
          item,
          chosenName,
          bill,
          batch,
          userId
        );
        updated++;
      } else {
        // Conflict detected - add to conflicts array
        conflicts.push({
          item,
          existingProduct: productsWithSameHSN[0],
          conflictType: "name-mismatch",
        });
      }
    }

    // Only commit if no conflicts or conflicts are resolved
    if (conflicts.length === 0) {
      // Mark bill as inventory added
      const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
      batch.update(billRef, {
        itemsAddedToInventory: true,
        inventoryAddedAt: new Date().toISOString(),
      });

      await batch.commit();
    }

    return { added, updated, conflicts };
  } catch (error) {
    console.error("Error adding purchase items to inventory:", error);
    throw error;
  }
};

export interface InventoryItemInput {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  gstRate?: number;
}

const updateExistingProduct = async (
  existingProduct: Product,
  item: InventoryItemInput,
  bill: PurchaseBill,
  batch: any,
  userId: string
) => {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, existingProduct.id);
  const newStock = existingProduct.stock + item.quantity;
  const updates: any = {
    stock: newStock,
    purchasePrice: item.purchasePrice,
  };

  if (item.sellingPrice > 0) {
    updates.sellingPrice = item.sellingPrice;
    updates.price = item.sellingPrice;
  }

  batch.update(productRef, updates);

  // Create inventory transaction record
  const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
  const transaction: InventoryTransaction = {
    id: transactionRef.id,
    productId: existingProduct.id,
    billId: bill.id,
    type: "purchase" as const,
    quantity: item.quantity,
    date: bill.createdAt,
    purchasePrice: item.purchasePrice,
    userId,
  };
  const cleanedTransactionData = removeUndefined(transaction);
  batch.set(transactionRef, cleanedTransactionData);
};

const updateExistingProductWithNameChange = async (
  existingProduct: Product,
  item: InventoryItemInput,
  chosenName: string,
  bill: PurchaseBill,
  batch: any,
  userId: string
) => {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, existingProduct.id);
  const newStock = existingProduct.stock + item.quantity;
  const updates: any = {
    name: chosenName, // Update name
    stock: newStock,
    purchasePrice: item.purchasePrice,
    gstRate: item.gstRate || existingProduct.gstRate,
    unit: item.unit || existingProduct.unit,
  };

  if (item.sellingPrice > 0) {
    updates.sellingPrice = item.sellingPrice;
    updates.price = item.sellingPrice;
  }

  batch.update(productRef, updates);

  // Create inventory transaction record
  const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
  const transaction: InventoryTransaction = {
    id: transactionRef.id,
    productId: existingProduct.id,
    billId: bill.id,
    type: "purchase" as const,
    quantity: item.quantity,
    date: bill.createdAt,
    purchasePrice: item.purchasePrice,
    userId,
  };
  const cleanedTransactionData = removeUndefined(transaction);
  batch.set(transactionRef, cleanedTransactionData);
};

const createNewProduct = async (
  item: InventoryItemInput,
  bill: PurchaseBill,
  batch: any,
  userId: string
) => {
  const newProduct: Product = {
    id: crypto.randomUUID(),
    name: item.description,
    hsnCode: item.hsnCode || "",
    gstRate: item.gstRate || 0,
    unit: item.unit || "pcs",
    price: item.sellingPrice || item.purchasePrice,
    purchasePrice: item.purchasePrice,
    sellingPrice: item.sellingPrice || item.purchasePrice,
    stock: item.quantity,
    createdAt: new Date().toISOString(),
    whereToBuy: bill.vendorName || "",
    weight: "",
  };

  const productRef = doc(db, COLLECTIONS.PRODUCTS, newProduct.id);
  const cleanedProductData = removeUndefined({ ...newProduct, userId });
  batch.set(productRef, cleanedProductData);

  // Create inventory transaction record
  const transactionRef = doc(collection(db, COLLECTIONS.INVENTORY));
  const transaction: InventoryTransaction = {
    id: transactionRef.id,
    productId: newProduct.id,
    billId: bill.id,
    type: "purchase" as const,
    quantity: item.quantity,
    date: bill.createdAt,
    purchasePrice: item.purchasePrice,
    userId,
  };
  const cleanedTransactionData = removeUndefined(transaction);
  batch.set(transactionRef, cleanedTransactionData);
};

export const isPurchaseBillDuplicate = async (
  billNumber: string,
  vendorName: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    if (!billNumber) return false;
    const bills = await getPurchaseBills();
    return bills.some(
      (b) =>
        b.id !== excludeId &&
        b.billNumber?.toLowerCase() === billNumber.toLowerCase() &&
        b.vendorName.toLowerCase() === vendorName.toLowerCase()
    );
  } catch (error) {
    console.error("Error checking purchase bill duplicate:", error);
    return false;
  }
};

export const isPurchaseBillInventoryAdded = async (
  billId: string
): Promise<boolean> => {
  try {
    const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = billSnap.data() as PurchaseBill;
      return bill.itemsAddedToInventory === true;
    }
    return false;
  } catch (error) {
    console.error("Error checking purchase bill inventory status:", error);
    return false;
  }
};

export const updatePurchaseBillOverdueStatus = async (): Promise<void> => {
  try {
    const bills = await getPurchaseBills();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const batch = writeBatch(db);
    let hasChanges = false;

    for (const bill of bills) {
      if (bill.paymentStatus !== "paid" && bill.dueDate) {
        const dueDate = new Date(bill.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          const billRef = doc(db, COLLECTIONS.PURCHASE_BILLS, bill.id);
          batch.update(billRef, { paymentStatus: "overdue" });
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error updating purchase bill overdue status:", error);
  }
};

export const checkStockAvailability = async (
  productId: string,
  requiredQty: number
): Promise<{ available: boolean; stock: number; productName: string }> => {
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      return { available: false, stock: 0, productName: "Unknown Product" };
    }

    const product = productSnap.data() as Product;
    const available = product.stock >= requiredQty && product.stock > 0;

    return {
      available,
      stock: product.stock,
      productName: product.name,
    };
  } catch (error) {
    console.error("Error checking stock availability:", error);
    return { available: false, stock: 0, productName: "Unknown Product" };
  }
};

export const validateBillStock = async (
  items: { productId: string; quantity: number }[]
): Promise<{ valid: boolean; errors: string[] }> => {
  try {
    const errors: string[] = [];

    for (const item of items) {
      if (item.quantity <= 0) {
        const product = await getDoc(
          doc(db, COLLECTIONS.PRODUCTS, item.productId)
        );
        const productName = product.exists()
          ? (product.data() as Product).name
          : "Unknown Product";
        errors.push(`${productName}: Quantity must be greater than 0`);
        continue;
      }

      const { available, stock, productName } = await checkStockAvailability(
        item.productId,
        item.quantity
      );
      if (!available) {
        errors.push(
          `${productName}: Required ${item.quantity.toFixed(
            2
          )}, Available ${stock.toFixed(2)}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("Error validating bill stock:", error);
    return { valid: false, errors: ["Error validating stock"] };
  }
};

// Bill Returns
export const getBillReturns = async (): Promise<BillReturn[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.BILL_RETURNS),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const returns = querySnapshot.docs.map((doc) => doc.data() as BillReturn);

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return returns.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting bill returns:", error);
    return [];
  }
};

export const saveBillReturn = async (billReturn: BillReturn): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.BILL_RETURNS, billReturn.id);
    const cleanedData = removeUndefined({ ...billReturn, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving bill return:", error);
    throw error;
  }
};

// Deadstock
export const getDeadstock = async (): Promise<DeadstockItem[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.DEADSTOCK),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const items = querySnapshot.docs.map((doc) => doc.data() as DeadstockItem);

    // Sort by createdAt descending in JavaScript (avoids index requirement)
    return items.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting deadstock:", error);
    return [];
  }
};

export const saveDeadstockItem = async (item: DeadstockItem): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.DEADSTOCK, item.id);
    const cleanedData = removeUndefined({ ...item, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving deadstock item:", error);
    throw error;
  }
};

export const processBillReturn = async (
  billId: string,
  returnItems: {
    productId: string;
    productName: string;
    quantity: number;
    condition: "good" | "bad";
    returnReason?: string;
    costPrice: number;
  }[]
): Promise<BillReturn> => {
  try {
    const userId = getUserId();
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error("Bill not found");
    }

    const bill = billSnap.data() as Bill;
    const billReturn: BillReturn = {
      id: crypto.randomUUID(),
      billId,
      billNumber: bill.billNumber,
      clientName: bill.client.name,
      items: returnItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        condition: item.condition,
        returnReason: item.returnReason,
      })),
      totalReturnValue: returnItems.reduce(
        (sum, item) => sum + item.quantity * item.costPrice,
        0
      ),
      returnDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const batch = writeBatch(db);

    // Process each returned item
    for (const item of returnItems) {
      if (item.condition === "good") {
        // Good product - add back to inventory
        const productRef = doc(db, COLLECTIONS.PRODUCTS, item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          const newStock = product.stock + item.quantity;
          // Round to 2 decimal places
          const roundedStock = Math.round(newStock * 100) / 100;
          batch.update(productRef, { stock: roundedStock });
        }
      } else {
        // Bad product - add to deadstock
        const deadstockItem: DeadstockItem = {
          id: crypto.randomUUID(),
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          costPrice: item.costPrice,
          billReturnId: billReturn.id,
          reason: item.returnReason || "Damaged/Defective",
          createdAt: new Date().toISOString(),
        };
        const deadstockRef = doc(db, COLLECTIONS.DEADSTOCK, deadstockItem.id);
        const cleanedDeadstockData = removeUndefined({
          ...deadstockItem,
          userId,
        });
        batch.set(deadstockRef, cleanedDeadstockData);
      }

      // Record inventory transaction
      const transaction: InventoryTransaction = {
        id: crypto.randomUUID(),
        productId: item.productId,
        billId: billReturn.id,
        type: "return",
        quantity: item.quantity,
        date: new Date().toISOString(),
        userId,
      };
      const transactionRef = doc(db, COLLECTIONS.INVENTORY, transaction.id);
      const cleanedTransactionData = removeUndefined({
        ...transaction,
        userId,
      });
      batch.set(transactionRef, cleanedTransactionData);
    }

    // Update the original bill
    await updateBillAfterReturn(billId, returnItems);

    // Save bill return
    const returnRef = doc(db, COLLECTIONS.BILL_RETURNS, billReturn.id);
    const cleanedReturnData = removeUndefined({ ...billReturn, userId });
    batch.set(returnRef, cleanedReturnData);

    await batch.commit();
    return billReturn;
  } catch (error) {
    console.error("Error processing bill return:", error);
    throw error;
  }
};

export const updateBillAfterReturn = async (
  billId: string,
  returnItems: {
    productId: string;
    quantity: number;
    costPrice: number;
    productName?: string;
    returnReason?: string;
  }[]
): Promise<void> => {
  try {
    const billRef = doc(db, COLLECTIONS.BILLS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) return;

    const bill = billSnap.data() as Bill;
    let totalReturnValue = 0;

    // Update item quantities in the bill
    const isIGST = bill.gstType === "igst";
    const updatedItems = bill.items
      .map((item) => {
        const returnItem = returnItems.find(
          (r) => r.productId === item.productId
        );
        if (returnItem) {
          const newQuantity = item.quantity - returnItem.quantity;
          const newAmount = newQuantity * item.ratePerUnit;

          // Recalculate GST based on bill's GST type
          let cgst = 0;
          let sgst = 0;
          let igst = 0;

          if (bill.totalTax > 0) {
            // Only calculate GST if bill has GST
            if (isIGST) {
              igst = (newAmount * item.gstRate) / 100;
            } else {
              cgst = (newAmount * item.gstRate) / 200;
              sgst = (newAmount * item.gstRate) / 200;
            }
          }

          totalReturnValue += returnItem.quantity * item.ratePerUnit;

          return {
            ...item,
            quantity: newQuantity,
            amount: newAmount,
            cgst,
            sgst,
            igst,
          };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    // Recalculate bill totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTax = updatedItems.reduce(
      (sum, item) => sum + item.cgst + item.sgst + (item.igst || 0),
      0
    );
    const rawTotal = subtotal + totalTax;
    const roundedTotal = Math.round(rawTotal);
    const roundOff = roundedTotal - rawTotal;

    const existingComment = bill.returnComment || "";
    const returnDate = new Date().toLocaleDateString("en-IN");
    const returnInfo = returnItems
      .map((r) => {
        const name = r.productName || "Item";
        const reason = r.returnReason ? ` (Reason: ${r.returnReason})` : "";
        return `${name}: ${r.quantity} returned${reason}`;
      })
      .join("; ");
    const returnComment = existingComment
      ? `${existingComment}\n${returnDate}: ${returnInfo}`
      : `${returnDate}: ${returnInfo}`;

    await updateDoc(billRef, {
      items: updatedItems,
      subtotal,
      totalTax,
      roundOff,
      total: roundedTotal,
      returnComment,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating bill after return:", error);
    throw error;
  }
};

export const getBillReturnsByBillId = async (
  billId: string
): Promise<BillReturn[]> => {
  try {
    const returns = await getBillReturns();
    return returns.filter((r) => r.billId === billId);
  } catch (error) {
    console.error("Error getting bill returns by bill ID:", error);
    return [];
  }
};

export const getReturnedQuantity = async (
  billId: string,
  productId: string
): Promise<number> => {
  try {
    const returns = await getBillReturnsByBillId(billId);
    return returns.reduce((sum, ret) => {
      const item = ret.items.find((i) => i.productId === productId);
      return sum + (item?.quantity || 0);
    }, 0);
  } catch (error) {
    console.error("Error getting returned quantity:", error);
    return 0;
  }
};

export const getTotalDeadstockLoss = async (): Promise<number> => {
  try {
    const deadstock = await getDeadstock();
    return deadstock.reduce(
      (sum, item) => sum + item.quantity * item.costPrice,
      0
    );
  } catch (error) {
    console.error("Error getting total deadstock loss:", error);
    return 0;
  }
};

export const getCostOfGoodsSold = async (): Promise<number> => {
  try {
    const bills = await getBills();
    const products = await getProducts();

    let totalCost = 0;
    bills.forEach((bill) => {
      bill.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        // Use purchasePrice (true cost) if available; fall back to price for legacy data
        const costPrice = product?.purchasePrice ?? product?.price ?? 0;
        totalCost += item.quantity * costPrice;
      });
    });

    return totalCost;
  } catch (error) {
    console.error("Error getting cost of goods sold:", error);
    return 0;
  }
};

// User Preferences (for theme, PWA settings, etc.)
export const getUserPreference = async (
  key: string
): Promise<string | null> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.USER_PREFERENCES, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const prefs = docSnap.data();
      return prefs[key] || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting user preference:", error);
    return null;
  }
};

export const setUserPreference = async (
  key: string,
  value: string
): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.USER_PREFERENCES, userId);
    const cleanedData = removeUndefined({ [key]: value, userId });
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error setting user preference:", error);
    throw error;
  }
};

// Expenses
export const getExpenses = async (): Promise<Expense[]> => {
  try {
    const userId = getUserId();
    // Try to query with orderBy, but if it fails (due to missing index), fall back to client-side sorting
    let querySnapshot;
    try {
      const q = query(
        collection(db, COLLECTIONS.EXPENSES),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      querySnapshot = await getDocs(q);
    } catch (orderByError) {
      // If orderBy fails (likely due to missing composite index), get all and sort client-side
      console.warn("OrderBy failed, sorting client-side:", orderByError);
      const q = query(
        collection(db, COLLECTIONS.EXPENSES),
        where("userId", "==", userId)
      );
      querySnapshot = await getDocs(q);
    }

    const expenses = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Expense)
    );

    // Sort by createdAt descending (most recent first), with fallback to date if createdAt is missing
    return expenses.sort((a, b) => {
      const dateA = a.createdAt || a.date || "";
      const dateB = b.createdAt || b.date || "";
      return dateB.localeCompare(dateA);
    });
  } catch (error) {
    console.error("Error getting expenses:", error);
    return [];
  }
};

export const saveExpense = async (expense: Expense): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.EXPENSES, expense.id);
    const expenseData = {
      ...expense,
      userId,
      // Preserve createdAt if it exists, otherwise set it to now
      createdAt: expense.createdAt || new Date().toISOString(),
    };
    const cleanedData = removeUndefined(expenseData);
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving expense:", error);
    throw error;
  }
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.EXPENSES, expenseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
};

// File Management
export const uploadFile = async (file: File): Promise<UploadedFile> => {
  try {
    const userId = getUserId();
    const fileId = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Get file extension safely
    const fileNameParts = file.name.split(".");
    const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop() || "" : "";
    
    // Sanitize file name for storage (remove special characters that might cause issues)
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageFileName = `${timestamp}_${fileId}${fileExtension ? `.${fileExtension}` : ""}`;
    const storagePath = `files/${userId}/${storageFileName}`;

    // Upload file to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);

    // Get download URL
    const downloadUrl = await getDownloadURL(storageRef);

    // Use the file.name as displayed name (which may be custom)
    const displayName = file.name;

    // Create file record in Firestore
    const uploadedFile: UploadedFile = {
      id: fileId,
      name: displayName,
      originalName: displayName,
      type: file.type || "application/octet-stream",
      size: file.size,
      downloadUrl,
      storagePath,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    const cleanedData = removeUndefined({ ...uploadedFile, userId });
    await setDoc(docRef, cleanedData);

    return uploadedFile;
  } catch (error) {
    console.error("Error uploading file:", error);
    // Provide more detailed error message
    if (error instanceof Error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
    throw new Error("Failed to upload file. Please try again.");
  }
};

export const getFiles = async (): Promise<UploadedFile[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, COLLECTIONS.FILES),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const files = querySnapshot.docs.map((doc) => doc.data() as UploadedFile);

    // Sort by uploadedAt descending
    return files.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting files:", error);
    return [];
  }
};

export const deleteFile = async (
  fileId: string,
  storagePath: string
): Promise<void> => {
  try {
    // Delete from Firestore
    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    await deleteDoc(docRef);

    // Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};

export const downloadFile = async (
  downloadUrl: string,
  fileName: string
): Promise<void> => {
  try {
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
};

// Notes Management
export const getNotes = async (date?: string): Promise<Note[]> => {
  try {
    const userId = getUserId();
    let q;

    if (date) {
      q = query(
        collection(db, COLLECTIONS.NOTES),
        where("userId", "==", userId),
        where("date", "==", date)
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.NOTES),
        where("userId", "==", userId)
      );
    }

    const querySnapshot = await getDocs(q);
    const notes = querySnapshot.docs.map((doc) => doc.data() as Note);

    // Sort by createdAt descending
    return notes.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting notes:", error);
    return [];
  }
};

export const getNotesByDate = async (date: string): Promise<Note[]> => {
  return getNotes(date);
};

export const saveNote = async (note: Note): Promise<void> => {
  try {
    const userId = getUserId();
    const docRef = doc(db, COLLECTIONS.NOTES, note.id);
    const noteData = {
      ...note,
      userId,
      updatedAt: new Date().toISOString(),
    };
    const cleanedData = removeUndefined(noteData);
    await setDoc(docRef, cleanedData, { merge: true });
  } catch (error) {
    console.error("Error saving note:", error);
    throw error;
  }
};

export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.NOTES, noteId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
};

export const updateNoteStatus = async (
  noteId: string,
  isDone: boolean
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.NOTES, noteId);
    await updateDoc(docRef, {
      isDone,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating note status:", error);
    throw error;
  }
};

export const getProductSalesData = async (productId: string) => {
  const allBills = await getBills();

  let totalSoldQty = 0;
  let totalSaleRevenue = 0;

  for (const bill of allBills) {
    for (const item of bill.items) {
      if (item.productId === productId) {
        totalSoldQty += item.quantity;
        totalSaleRevenue += item.quantity * item.ratePerUnit;
      }
    }
  }

  return { totalSoldQty, totalSaleRevenue };
};


const SAMPLE_BILLS_COLLECTION = "sampleBills";
const SAMPLE_BILL_COUNTER_DOC = "sampleBillCounter";

export const getSampleBills = async (): Promise<SampleBill[]> => {
  try {
    const userId = getUserId();
    const q = query(
      collection(db, SAMPLE_BILLS_COLLECTION),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    const bills = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        client: {
          ...data.client,
          billingAddress:
            data.client.billingAddress || data.client.address || "",
          shippingAddress: data.client.shippingAddress || "",
        },
      } as SampleBill;
    });

    // Sort by createdAt descending
    return bills.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error getting sample bills:", error);
    return [];
  }
};

// Get single sample bill by ID
export const getSampleBillById = async (
  id: string
): Promise<SampleBill | null> => {
  try {
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, id);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const data = billSnap.data();
      return {
        ...data,
        client: {
          ...data.client,
          billingAddress:
            data.client.billingAddress || data.client.address || "",
          shippingAddress: data.client.shippingAddress || "",
        },
      } as SampleBill;
    }
    return null;
  } catch (error) {
    console.error("Error getting sample bill:", error);
    return null;
  }
};

// Save sample bill (NO STOCK UPDATES)
export const saveSampleBill = async (bill: SampleBill): Promise<void> => {
  try {
    const userId = getUserId();
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, bill.id);

    await setDoc(billRef, {
      ...bill,
      userId,
      isSample: true,
    });
  } catch (error) {
    console.error("Error saving sample bill:", error);
    throw error;
  }
};

// Delete sample bill (NO STOCK RESTORATION)
export const deleteSampleBill = async (id: string): Promise<void> => {
  try {
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, id);
    await deleteDoc(billRef);
  } catch (error) {
    console.error("Error deleting sample bill:", error);
    throw error;
  }
};

// Update sample bill payment
export const updateSampleBillPayment = async (
  billId: string,
  paidAmount: number,
  paymentType: PaymentMethod,
  note?: string
): Promise<void> => {
  try {
    const billRef = doc(db, SAMPLE_BILLS_COLLECTION, billId);
    const billSnap = await getDoc(billRef);

    if (billSnap.exists()) {
      const bill = billSnap.data() as SampleBill;
      const newPaidAmount = bill.paidAmount + paidAmount;
      const paymentStatus =
        newPaidAmount >= bill.total ? "paid" : bill.paymentStatus;

      const newPayment: PaymentTransaction = {
        id: Math.random().toString(36).substr(2, 9),
        amount: paidAmount,
        method: paymentType,
        date: new Date().toISOString(),
        note: note,
      };

      const payments = Array.isArray(bill.payments) ? [...bill.payments, newPayment] : [newPayment];

      await updateDoc(billRef, {
        paidAmount: newPaidAmount,
        paymentStatus,
        paymentType: paymentType,
        payments: removeUndefined(payments),
      });
    }
  } catch (error) {
    console.error("Error updating sample bill payment:", error);
    throw error;
  }
};

// Get sample bill counter
export const getSampleBillCounter = async (): Promise<number> => {
  try {
    const userId = getUserId();
    const counterRef = doc(
      db,
      COLLECTIONS.COUNTERS,
      `${userId}_${SAMPLE_BILL_COUNTER_DOC}`
    );
    const counterSnap = await getDoc(counterRef);

    if (counterSnap.exists()) {
      return counterSnap.data().value || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error getting sample bill counter:", error);
    return 0;
  }
};

// Increment sample bill counter
export const incrementSampleBillCounter = async (): Promise<number> => {
  try {
    const userId = getUserId();
    const counterRef = doc(
      db,
      COLLECTIONS.COUNTERS,
      `${userId}_${SAMPLE_BILL_COUNTER_DOC}`
    );
    const counterSnap = await getDoc(counterRef);

    let newValue = 1;
    if (counterSnap.exists()) {
      newValue = (counterSnap.data().value || 0) + 1;
    }

    await setDoc(counterRef, { value: newValue });
    return newValue;
  } catch (error) {
    console.error("Error incrementing sample bill counter:", error);
    throw error;
  }
};