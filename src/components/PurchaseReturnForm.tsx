import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchaseBill, PurchaseReturn, PurchaseReturnItem } from "@/types";
import { getProducts, savePurchaseReturn, updateProductStock } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Loader2 } from "lucide-react";

interface PurchaseReturnFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: PurchaseBill;
  onSuccess: () => void;
}

export function PurchaseReturnForm({ open, onOpenChange, bill, onSuccess }: PurchaseReturnFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PurchaseReturnItem[]>([]);

  useEffect(() => {
    if (open && bill) {
      // Default to returning 0 for all items, user can add what they want
      setItems([]);
    }
  }, [open, bill]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, rate: 0, amount: 0, gstRate: 0, gstAmount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseReturnItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "rate" || field === "gstRate") {
      item.amount = (item.quantity || 0) * (item.rate || 0);
      item.gstAmount = (item.amount * (item.gstRate || 0)) / 100;
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Error", description: "Add at least one item to return", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const totalReturnValue = items.reduce((sum, item) => sum + item.amount + (item.gstAmount || 0), 0);
      
      const purchaseReturn: PurchaseReturn = {
        id: crypto.randomUUID(),
        purchaseBillId: bill.id,
        vendorName: bill.vendorName,
        billNumber: bill.billNumber,
        items,
        totalReturnValue,
        returnDate: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      };

      await savePurchaseReturn(purchaseReturn, true);
      
      // Adjust stock for each returned item
      for (const item of items) {
        // Find product by description and update stock
        const products = await getProducts();
        const product = products.find(p => p.name.toLowerCase() === item.description.toLowerCase());
        
        if (product) {
          console.log(`Adjusting stock for return: ${product.name}, qty: -${item.quantity}`);
          await updateProductStock(product.id, -item.quantity); // Negative to decrease stock
        } else {
          console.log(`Product not found for return description: ${item.description}`);
        }
      }

      toast({ title: "Success", description: "Purchase return recorded and stock adjusted" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving return:", error);
      toast({ title: "Error", description: "Failed to save return", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Items - Bill #{bill.billNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end border p-2 rounded">
                <div className="col-span-4">
                  <Label>Item Description</Label>
                  <Input 
                    value={item.description} 
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Select or type item"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Qty</Label>
                  <Input 
                    type="number" 
                    value={item.quantity} 
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Rate</Label>
                  <Input 
                    type="number" 
                    value={item.rate} 
                    onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>GST %</Label>
                  <Input 
                    type="number" 
                    value={item.gstRate} 
                    onChange={(e) => updateItem(index, "gstRate", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Item to Return
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
