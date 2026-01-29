import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/types";
import {
  saveProduct,
  getCompanyProfile,
  addStockToProduct,
} from "@/lib/storage";
import { calculateSellingPriceFromCommission } from "@/lib/billUtils";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (product: Product) => void;
}

export function ProductForm({
  open,
  onOpenChange,
  onSuccess,
}: ProductFormProps) {
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [addInitialStock, setAddInitialStock] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    hsnCode: "",
    gstRate: "",
    unit: "kg",
    purchasePrice: "",
    sellingPrice: "",
    whereToBuy: "",
    weight: "",
  });

  const [initialStock, setInitialStock] = useState({
    quantity: "",
    purchasePrice: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getCompanyProfile();
      setCompanyProfile(profile);
      if (profile?.defaultUnit) {
        setFormData((prev) => ({
          ...prev,
          unit: profile.defaultUnit,
        }));
      }
    };
    loadProfile();
  }, []);

  const resetForm = () => {
    setAddInitialStock(false);
    setFormData({
      name: "",
      hsnCode: "",
      gstRate: "",
      unit: companyProfile?.defaultUnit || "kg",
      purchasePrice: "",
      sellingPrice: "",
      whereToBuy: "",
      weight: "",
    });
    setInitialStock({ quantity: "", purchasePrice: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const purchasePriceNum = parseFloat(formData.purchasePrice) || 0;
      const sellingPriceNum = parseFloat(formData.sellingPrice) || 0;

      const product: Product = {
        id: crypto.randomUUID(),
        name: formData.name,
        hsnCode: formData.hsnCode.trim(),
        gstRate: parseFloat(formData.gstRate) || 0,
        unit: formData.unit,
        price: sellingPriceNum,
        purchasePrice: purchasePriceNum,
        sellingPrice: sellingPriceNum,
        stock: 0,
        whereToBuy: formData.whereToBuy,
        weight: formData.weight,
        createdAt: new Date().toISOString(),
      };

      await saveProduct(product);

      if (addInitialStock) {
        const qty = parseFloat(initialStock.quantity) || 0;
        const price = parseFloat(initialStock.purchasePrice) || 0;

        if (qty > 0 && price > 0) {
          await addStockToProduct(product.id, qty, price);
        }
      }

      toast.success("Product created successfully");
      onSuccess(product);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const unitOptions =
    companyProfile?.unitOptions?.length > 0
      ? companyProfile.unitOptions
      : ["kg", "pcs", "box"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Product</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>HSN Code *</Label>
              <Input
                required
                value={formData.hsnCode}
                onChange={(e) =>
                  setFormData({ ...formData, hsnCode: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>GST Rate (%) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={formData.gstRate}
                onChange={(e) =>
                  setFormData({ ...formData, gstRate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) =>
                  setFormData({ ...formData, unit: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((unit: string) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Purchase Price *</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => {
                  const price = parseFloat(e.target.value) || 0;
                  const selling = calculateSellingPriceFromCommission(
                    price,
                    companyProfile?.commissionSettings
                  );
                  setFormData({
                    ...formData,
                    purchasePrice: e.target.value,
                    sellingPrice: price ? String(selling) : "",
                  });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Selling Price (with Commission) *</Label>
            <Input
              required
              type="number"
              step="0.01"
              value={formData.sellingPrice}
              onChange={(e) =>
                setFormData({ ...formData, sellingPrice: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) =>
                  setFormData({ ...formData, weight: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Bought From</Label>
              <Input
                value={formData.whereToBuy}
                onChange={(e) =>
                  setFormData({ ...formData, whereToBuy: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={addInitialStock}
                onCheckedChange={(v) => setAddInitialStock(!!v)}
              />
              <Label>Add initial stock?</Label>
            </div>

            {addInitialStock && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={initialStock.quantity}
                  onChange={(e) =>
                    setInitialStock({
                      ...initialStock,
                      quantity: e.target.value,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Purchase Price"
                  value={initialStock.purchasePrice}
                  onChange={(e) =>
                    setInitialStock({
                      ...initialStock,
                      purchasePrice: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Product"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
