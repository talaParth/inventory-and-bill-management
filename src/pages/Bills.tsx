import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getBills, deleteBill, updateBillPayment } from '@/lib/storage';
import { getCompanyProfile, saveCompanyProfile } from '@/lib/firebaseService';
import { Bill, PaymentMethod, CompanyProfile } from '@/types';
import { formatCurrency, formatDate } from '@/lib/billUtils';
import { Plus, Search, Eye, Edit, Trash2, Filter, IndianRupee, Loader2, Calendar, User, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentDialog } from '@/components/PaymentDialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
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
} from '@/components/ui/alert-dialog';

export default function Bills() {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [updatingGst, setUpdatingGst] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gstFilter, setGstFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterAndSortBills();
  }, [bills, searchTerm, statusFilter, gstFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [filteredBills.length, searchTerm, statusFilter, gstFilter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allBills, companyProfile] = await Promise.all([
        getBills(),
        getCompanyProfile()
      ]);
      setBills(allBills);
      setCompany(companyProfile);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleGst = async (enabled: boolean) => {
    if (!company) return;
    try {
      setUpdatingGst(true);
      const updatedProfile = { ...company, gstEnabled: enabled };
      await saveCompanyProfile(updatedProfile);
      setCompany(updatedProfile);
      toast.success(`GST Billing ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating GST setting:', error);
      toast.error('Failed to update GST setting');
    } finally {
      setUpdatingGst(false);
    }
  };

  const loadBills = async () => {
    // Keep for backward compatibility if called elsewhere
    loadData();
  };

  const filterAndSortBills = () => {
    let filtered = [...bills];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (bill) =>
          bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bill.client.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((bill) => bill.paymentStatus === statusFilter);
    }

    // GST filter
    if (gstFilter !== 'all') {
      if (gstFilter === 'gst') {
        filtered = filtered.filter((bill) => bill.totalTax > 0);
      } else if (gstFilter === 'non-gst') {
        filtered = filtered.filter((bill) => bill.totalTax === 0);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc':
          return b.total - a.total;
        case 'amount-asc':
          return a.total - b.total;
        default:
          return 0;
      }
    });

    setFilteredBills(filtered);
  };

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedBills = filteredBills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await new Promise(resolve => setTimeout(resolve, 500));
    await deleteBill(id);
    await loadBills();
    setDeletingId(null);
    toast.success('Bill deleted successfully');
  };

  const handlePaymentCollected = async (amount: number, type: PaymentMethod, note?: string) => {
    if (selectedBill) {
      await updateBillPayment(selectedBill.id, amount, type, note);
      await loadBills();
      toast.success(`Payment of ${formatCurrency(amount)} via ${type} collected successfully`);
    }
  };

  const openPaymentDialog = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: 'default',
      pending: 'secondary',
      overdue: 'destructive',
    } as const;

    const labels = {
      paid: 'Paid',
      pending: 'Pending',
      overdue: 'Overdue',
    };



    return (
      <Badge variant={variants[status as keyof typeof variants]} className="text-xs">
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  
if (loading) {
  return <LoadingSpinner size="xl" text="Loading products..." fullScreen />;
}

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 p-3 sm:p-4 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">Bills</h1>
          <p className="text-xs sm:text-sm text-muted-foreground break-words">Manage all your invoices</p>
        </div>
        <div className="flex flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center space-x-2 bg-card border px-3 py-2 rounded-md shadow-sm">
            <Switch
              id="gst-toggle"
              checked={company?.gstEnabled || false}
              onCheckedChange={toggleGst}
              disabled={updatingGst || !company}
            />
            <Label htmlFor="gst-toggle" className="text-sm font-medium cursor-pointer">
              GST {company?.gstEnabled ? 'ON' : 'OFF'}
            </Label>
          </div>
          <Link to="/bills/new" className="flex-1 sm:flex-initial">
            <Button size="default" className="w-full sm:w-auto text-xs sm:text-sm touch-manipulation">
              <Plus className="h-4 w-4 mr-2" />
              Create Bill
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm w-full max-w-full overflow-hidden">
        <CardContent className="pt-4 sm:pt-5 pb-4 sm:pb-5 px-3 sm:px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 sm:h-11 border-2 text-sm"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 sm:h-11 border-2 text-sm">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={gstFilter} onValueChange={setGstFilter}>
              <SelectTrigger className="h-10 sm:h-11 border-2 text-sm">
                <Receipt className="h-4 w-4 mr-2" />
                <SelectValue placeholder="GST Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bills</SelectItem>
                <SelectItem value="gst">GST Bills</SelectItem>
                <SelectItem value="non-gst">Non-GST Bills</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-10 sm:h-11 border-2 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date (Newest)</SelectItem>
                <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      <div className="space-y-3">
        {filteredBills.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-foreground mb-2">No bills found</p>
              <p className="text-sm text-muted-foreground mb-4">Get started by creating your first invoice</p>
              <Link to="/bills/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Bill
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          pagedBills.map((bill) => (
            <Card key={bill.id} className="hover:shadow-lg transition-all duration-200 border-l-4 w-full max-w-full overflow-hidden" style={{ borderLeftColor: bill.paymentStatus === 'paid' ? '#10b981' : bill.paymentStatus === 'overdue' ? '#ef4444' : '#f59e0b' }}>
              <CardContent className="p-3 sm:p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:gap-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5 sm:mb-2">
                        <span className="font-bold text-base sm:text-lg md:text-xl text-foreground break-words">{bill.billNumber}</span>
                        {getStatusBadge(bill.paymentStatus)}
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                        </div>
                        <span className="font-medium truncate break-words">{bill.client.name}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-primary text-lg sm:text-xl md:text-2xl font-bold break-words">
                        {formatCurrency(bill.total)}
                      </p>
                      {bill.paymentStatus !== 'paid' && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 break-words">
                          Paid: {formatCurrency(bill.paidAmount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 text-xs sm:text-sm border-t border-border pt-2 sm:pt-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                        <div className="h-5 w-5 sm:h-6 sm:w-6 rounded bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
                        </div>
                        <span className="break-words">{formatDate(bill.date)}</span>
                      </div>
                      {bill.paymentStatus === 'overdue' && (
                        <Badge variant="destructive" className="text-[10px] sm:text-xs">
                          Due: {formatDate(bill.dueDate)}
                        </Badge>
                      )}
                    </div>
                    {bill.paymentStatus !== 'paid' && (
                      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-orange-500/10 rounded-md border border-orange-200 w-full sm:w-auto justify-center sm:justify-start">
                        <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 flex-shrink-0" />
                        <span className="text-orange-600 font-semibold text-xs sm:text-sm break-words">
                          Pending: {formatCurrency(bill.total - bill.paidAmount)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 border-t border-border pt-2 sm:pt-3">
                    {bill.paymentStatus !== 'paid' ? (
                      <Button
                        variant="default"
                        size="default"
                        onClick={() => openPaymentDialog(bill)}
                        className="gap-2 flex-1 sm:flex-none text-xs sm:text-sm touch-manipulation"
                      >
                        <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Collect Payment
                      </Button>
                    ) : (
                      <Badge variant="default" className="bg-green-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 w-full sm:w-auto justify-center sm:justify-start">
                        ✓ Fully Paid
                      </Badge>
                    )}

                    <div className="flex gap-1.5 sm:gap-2 justify-end">
                      <Link to={`/bills/${bill.id}`} className="flex-1 sm:flex-none">
                        <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1.5 sm:gap-2 w-full sm:w-auto text-xs sm:text-sm touch-manipulation">
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </Link>
                      <Link to={`/bills/${bill.id}/edit`} className="flex-1 sm:flex-none">
                        <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1.5 sm:gap-2 w-full sm:w-auto text-xs sm:text-sm touch-manipulation">
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 sm:h-9 w-8 sm:w-9 p-0 text-destructive hover:text-destructive touch-manipulation" disabled={deletingId === bill.id}>
                            {deletingId === bill.id ? (
                              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base sm:text-lg">Delete Bill</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm break-words">
                              Are you sure you want to delete bill {bill.billNumber}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(bill.id)} className="w-full sm:w-auto bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {filteredBills.length > pageSize && (
          <Card className="w-full max-w-full overflow-hidden">
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <p className="text-xs sm:text-sm font-medium text-foreground break-words text-center sm:text-left">
                  Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredBills.length)} of {filteredBills.length} bills
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="gap-2 text-xs sm:text-sm touch-manipulation flex-1 sm:flex-none"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-muted rounded-md">
                    <span className="text-xs sm:text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="gap-2 text-xs sm:text-sm touch-manipulation flex-1 sm:flex-none"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedBill && (
        <PaymentDialog
          bill={selectedBill}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          onPaymentCollected={handlePaymentCollected}
        />
      )}
    </div>
  );
}