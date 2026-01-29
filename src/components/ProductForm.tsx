import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Product } from "@/types";
import { saveProduct, getCompanyProfile } from "@/lib/storage";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (product: Product) => void;
}

export function ProductForm({ open, onOpenChange, onSuccess }: ProductFormProps) {
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    hsnCode: "",
    gstRate: "",
    unit: "kg",
    sellingPrice: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getCompanyProfile();
      setCompanyProfile(profile);
      if (profile?.defaultUnit) {
        setFormData(prev => ({ ...prev, unit: profile.defaultUnit }));
      }
    };
    loadProfile();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      hsnCode: "",
      gstRate: "",
      unit: companyProfile?.defaultUnit || "kg",
      sellingPrice: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    try {
      const gstRateNum = parseFloat(formData.gstRate) || 0;
      const sellingPriceNum = parseFloat(formData.sellingPrice) || 0;

      const product: Product = {
        id: crypto.randomUUID(),
        name: formData.name,
        hsnCode: formData.hsnCode.trim(),
        gstRate: gstRateNum,
        unit: formData.unit,
        price: sellingPriceNum,
        sellingPrice: sellingPriceNum,
        purchasePrice: 0,
        stock: 0,
        whereToBuy: "",
        weight: "",
        createdAt: new Date().toISOString(),
      };

      await saveProduct(product);
      onSuccess(product);
      onOpenChange(false);
      resetForm();
      toast.success("Product added successfully");
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const unitOptions = companyProfile?.unitOptions && companyProfile.unitOptions.length > 0
    ? companyProfile.unitOptions
    : ["kg", "pcs", "box"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter product name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>HSN Code *</Label>
              <Input
                required
                value={formData.hsnCode}
                onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                placeholder="HSN Code"
              />
            </div>

            <div className="space-y-2">
              <Label>GST Rate (%) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={formData.gstRate}
                onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
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
              <Label>Selling Price *</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
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
                  Adding...
                </>
              ) : (
                "Add Product"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
