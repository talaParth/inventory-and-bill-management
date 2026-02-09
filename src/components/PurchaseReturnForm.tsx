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
import { Checkbox } from "@/components/ui/checkbox";
import { PurchaseBill, PurchaseReturn, PurchaseReturnItem } from "@/types";
import { getProducts, savePurchaseReturn, updateProductStock } from "@/lib/firebaseService";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ReturnItemState {
  selected: boolean;
  returnQuantity: number;
  maxQuantity: number;
  description: string;
  rate: number;
  gstRate: number;
  unit: string;
}

interface PurchaseReturnFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: PurchaseBill | null;
  onSuccess: () => void;
}

export function PurchaseReturnForm({ open, onOpenChange, bill, onSuccess }: PurchaseReturnFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (open && bill) {
      setReturnDate(new Date().toISOString().split("T")[0]);
      const itemsState: ReturnItemState[] = bill.items.map(item => ({
        selected: false,
        returnQuantity: 0,
        maxQuantity: item.quantity,
        description: item.description,
        rate: item.rate,
        gstRate: item.gstRate || 0,
        unit: item.unit,
      }));
      setReturnItems(itemsState);
    }
  }, [open, bill]);

  if (!bill) {
    return null;
  }

  const toggleItem = (index: number, checked: boolean) => {
    const newItems = [...returnItems];
    newItems[index].selected = checked;
    if (checked && newItems[index].returnQuantity === 0) {
      newItems[index].returnQuantity = 1;
    }
    if (!checked) {
      newItems[index].returnQuantity = 0;
    }
    setReturnItems(newItems);
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...returnItems];
    const maxQty = newItems[index].maxQuantity;
    const validQty = Math.min(Math.max(0, quantity), maxQty);
    newItems[index].returnQuantity = validQty;
    newItems[index].selected = validQty > 0;
    setReturnItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedItems = returnItems.filter(item => item.selected && item.returnQuantity > 0);
    
    if (selectedItems.length === 0) {
      toast({ title: "Error", description: "Select at least one item to return", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const items: PurchaseReturnItem[] = selectedItems.map(item => {
        const amount = item.returnQuantity * item.rate;
        const gstAmount = (amount * item.gstRate) / 100;
        return {
          description: item.description,
          quantity: item.returnQuantity,
          rate: item.rate,
          amount,
          gstRate: item.gstRate,
          gstAmount,
        };
      });

      const totalReturnValue = items.reduce((sum, item) => sum + item.amount + (item.gstAmount || 0), 0);
      
      const purchaseReturn: PurchaseReturn = {
        id: crypto.randomUUID(),
        purchaseBillId: bill.id,
        vendorName: bill.vendorName,
        billNumber: bill.billNumber,
        items,
        totalReturnValue,
        returnDate,
        createdAt: new Date().toISOString(),
      };

      await savePurchaseReturn(purchaseReturn, true);
      
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

  const totalReturnAmount = returnItems
    .filter(item => item.selected && item.returnQuantity > 0)
    .reduce((sum, item) => {
      const amount = item.returnQuantity * item.rate;
      const gstAmount = (amount * item.gstRate) / 100;
      return sum + amount + gstAmount;
    }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Items - Bill #{bill.billNumber}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select items from this bill to return. Quantity cannot exceed original purchase.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="returnDate">Return Date</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left w-10">Return</th>
                  <th className="p-2 text-left">Item Description</th>
                  <th className="p-2 text-right w-24">Purchased</th>
                  <th className="p-2 text-right w-28">Return Qty</th>
                  <th className="p-2 text-right w-20">Rate</th>
                  <th className="p-2 text-right w-20">GST %</th>
                  <th className="p-2 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, index) => {
                  const amount = item.returnQuantity * item.rate;
                  const gstAmount = (amount * item.gstRate) / 100;
                  const totalAmount = amount + gstAmount;
                  
                  return (
                    <tr key={index} className={`border-t ${item.selected ? 'bg-blue-50' : ''}`}>
                      <td className="p-2">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={(checked) => toggleItem(index, checked === true)}
                        />
                      </td>
                      <td className="p-2 font-medium">{item.description}</td>
                      <td className="p-2 text-right text-muted-foreground">
                        {item.maxQuantity} {item.unit}
                      </td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={item.maxQuantity}
                          value={item.returnQuantity}
                          onChange={(e) => updateQuantity(index, parseFloat(e.target.value) || 0)}
                          className="w-20 text-right ml-auto"
                          disabled={!item.selected && item.returnQuantity === 0}
                        />
                      </td>
                      <td className="p-2 text-right">{item.rate.toFixed(2)}</td>
                      <td className="p-2 text-right">{item.gstRate}%</td>
                      <td className="p-2 text-right font-medium">
                        {item.selected && item.returnQuantity > 0 
                          ? `₹${totalAmount.toFixed(2)}`
                          : '-'
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {returnItems.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No items found in this bill
            </p>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-lg font-semibold">
              Total Return Value: <span className="text-primary">₹{totalReturnAmount.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || totalReturnAmount === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
