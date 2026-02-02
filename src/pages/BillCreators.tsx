import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { getCompanyProfile, getBills, getSampleBills, saveCompanyProfile } from "@/lib/storage";
import { Bill, SampleBill, CompanyProfile } from "@/types";
import { User, Receipt, ArrowLeft, Search, Calendar, Plus, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/billUtils";
import { useToast } from "@/hooks/use-toast";

export default function BillCreators() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creators, setCreators] = useState<string[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [creatorBills, setCreatorBills] = useState<(Bill | SampleBill)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCreatorName, setNewCreatorName] = useState("");
  const [editingCreator, setEditingCreator] = useState<string | null>(null);
  const [editedCreatorName, setEditedCreatorName] = useState("");
  const [creatorToDelete, setCreatorToDelete] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const profile = await getCompanyProfile();
      if (profile) {
        setCompanyProfile(profile);
        if (profile.billCreators) {
          setCreators(profile.billCreators);
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAddCreator = async () => {
    if (!newCreatorName.trim()) return;
    if (creators.includes(newCreatorName.trim())) {
      toast({ title: "Creator already exists", variant: "destructive" });
      return;
    }
    const updatedCreators = [...creators, newCreatorName.trim()];
    if (companyProfile) {
      await saveCompanyProfile({ ...companyProfile, billCreators: updatedCreators });
      setCreators(updatedCreators);
      setNewCreatorName("");
      setIsAddDialogOpen(false);
      toast({ title: "Creator added successfully" });
    }
  };

  const handleEditCreator = async () => {
    if (!editedCreatorName.trim() || !editingCreator) return;
    if (creators.includes(editedCreatorName.trim()) && editedCreatorName.trim() !== editingCreator) {
      toast({ title: "Creator name already exists", variant: "destructive" });
      return;
    }
    const updatedCreators = creators.map(c => c === editingCreator ? editedCreatorName.trim() : c);
    if (companyProfile) {
      await saveCompanyProfile({ ...companyProfile, billCreators: updatedCreators });
      setCreators(updatedCreators);
      setEditingCreator(null);
      setEditedCreatorName("");
      setIsEditDialogOpen(false);
      toast({ title: "Creator updated successfully" });
    }
  };

  const handleDeleteCreator = async () => {
    if (!creatorToDelete) return;
    const updatedCreators = creators.filter(c => c !== creatorToDelete);
    if (companyProfile) {
      await saveCompanyProfile({ ...companyProfile, billCreators: updatedCreators });
      setCreators(updatedCreators);
      setCreatorToDelete(null);
      setIsDeleteDialogOpen(false);
      toast({ title: "Creator deleted successfully" });
    }
  };

  const openEditDialog = (creator: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCreator(creator);
    setEditedCreatorName(creator);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (creator: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCreatorToDelete(creator);
    setIsDeleteDialogOpen(true);
  };

  useEffect(() => {
    const loadCreatorBills = async () => {
      if (!selectedCreator) return;
      setLoading(true);
      const [regularBills, sampleBills] = await Promise.all([
        getBills(),
        getSampleBills(),
      ]);
      
      const allBills = [...regularBills, ...sampleBills];
      const filtered = allBills.filter(
        (bill) => bill.createdBy === selectedCreator
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setCreatorBills(filtered);
      setLoading(false);
    };
    loadCreatorBills();
  }, [selectedCreator]);

  const filteredCreators = creators.filter(c => 
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedCreator) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedCreator(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Bills by {selectedCreator}</h1>
            <p className="text-muted-foreground">Total bills: {creatorBills.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {creatorBills.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No bills found for this creator.
              </CardContent>
            </Card>
          ) : (
            creatorBills.map((bill) => (
              <Card 
                key={bill.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate('isSample' in bill ? `/sample-bills/${bill.id}` : `/bills/${bill.id}`)}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{bill.billNumber}</span>
                      {('isSample' in bill) && <Badge variant="outline">Sample</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{bill.client.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(bill.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(bill.total)}</p>
                    <Badge variant={bill.paymentStatus === 'paid' ? 'secondary' : 'outline'}>
                      {bill.paymentStatus}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            Bill Creators
          </h1>
          <p className="text-muted-foreground">Manage and view performance of bill creators</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Creator
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search creators..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredCreators.map((creator) => (
          <Card 
            key={creator} 
            className="hover:border-primary transition-colors cursor-pointer group"
            onClick={() => setSelectedCreator(creator)}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => openEditDialog(creator, e)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => openDeleteDialog(creator, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle>{creator}</CardTitle>
              <CardDescription>Click to view bills</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between text-primary">
                View History
                <Receipt className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {filteredCreators.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-muted-foreground">No creators found.</p>
            <Button 
              className="mt-4"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Creator
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Creator</DialogTitle>
            <DialogDescription>
              Enter the name of the new bill creator.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Creator name"
            value={newCreatorName}
            onChange={(e) => setNewCreatorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCreator()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCreator}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Creator</DialogTitle>
            <DialogDescription>
              Update the creator's name.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Creator name"
            value={editedCreatorName}
            onChange={(e) => setEditedCreatorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEditCreator()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCreator}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Creator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{creatorToDelete}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCreator}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
