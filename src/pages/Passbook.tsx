import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getBills, getPurchaseBills, getExpenses, getBillReturns } from '@/lib/storage';
import { Bill, PurchaseBill, Expense, BillReturn } from '@/types';
import {
    BookOpen,
    TrendingUp,
    TrendingDown,
    Minus,
    Plus,
    Calendar,
    Filter,
    Download,
    ArrowUpDown,
    Loader2
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/billUtils';
import * as XLSX from 'xlsx';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface PassbookEntry {
    id: string;
    date: string;
    type: 'sale' | 'purchase' | 'expense' | 'return' | 'payment';
    description: string;
    amount: number;
    balance: number;
    details: any;
    category?: string;
}

export default function Passbook() {
    const [entries, setEntries] = useState<PassbookEntry[]>([]);
    const [filteredEntries, setFilteredEntries] = useState<PassbookEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [gstFilter, setGstFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState({
        start: '',
        end: '',
    });

    useEffect(() => {
        loadPassbookData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [entries, filterType, filterCategory, gstFilter, dateRange, sortOrder]);

    const loadPassbookData = async () => {
        setLoading(true);
        try {
            const [bills, purchaseBills, expenses, returns] = await Promise.all([
                getBills(),
                getPurchaseBills(),
                getExpenses(),
                getBillReturns(),
            ]);

            const allEntries: PassbookEntry[] = [];

            // Add sales (positive amounts for received payments)
            bills.forEach(bill => {
                if (bill.payments && bill.payments.length > 0) {
                    bill.payments.forEach(payment => {
                        allEntries.push({
                            id: `payment-${payment.id}`,
                            date: payment.date,
                            type: 'payment',
                            description: `Payment Received - Bill #${bill.billNumber} (${payment.method})${payment.note ? ` - ${payment.note}` : ''}`,
                            amount: payment.amount,
                            balance: 0,
                            details: { ...bill, currentPayment: payment },
                        });
                    });
                } else if (bill.paymentStatus === 'paid' || (bill.paidAmount && bill.paidAmount > 0)) {
                    // Fallback for bills without explicit payments array (legacy data)
                    allEntries.push({
                        id: `sale-${bill.id}`,
                        date: bill.date,
                        type: 'sale',
                        description: `Sale - Bill #${bill.billNumber} to ${bill.client.name}`,
                        amount: bill.paidAmount || bill.total,
                        balance: 0,
                        details: bill,
                    });
                }
            });

            // Add purchases (negative amounts for money spent)
            purchaseBills.forEach(purchase => {
                allEntries.push({
                    id: `purchase-${purchase.id}`,
                    date: purchase.createdAt || purchase.billDate || purchase.id,
                    type: 'purchase',
                    description: `Purchase - ${purchase.vendorName || 'Vendor'} - Bill #${purchase.billNumber || 'N/A'}`,
                    amount: -purchase.total,
                    balance: 0,
                    details: purchase,
                });
            });

            // Add expenses (negative amounts for money spent)
            expenses.forEach(expense => {
                allEntries.push({
                    id: `expense-${expense.id}`,
                    date: expense.date,
                    type: 'expense',
                    description: expense.description,
                    amount: -expense.amount,
                    balance: 0,
                    details: expense,
                    category: expense.category,
                });
            });

            // Add returns (negative amounts for refunds given)
            returns.forEach(returnItem => {
                allEntries.push({
                    id: `return-${returnItem.id}`,
                    date: returnItem.returnDate,
                    type: 'return',
                    description: `Return - Bill #${returnItem.billNumber} - ${returnItem.clientName}`,
                    amount: -returnItem.totalReturnValue,
                    balance: 0,
                    details: returnItem,
                });
            });

            // Sort by date and calculate running balance
            const sortedEntries = allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            let runningBalance = 0;
            const entriesWithBalance = sortedEntries.map(entry => {
                runningBalance += entry.amount;
                return {
                    ...entry,
                    balance: runningBalance,
                };
            });

            setEntries(entriesWithBalance);
        } catch (error) {
            console.error('Error loading passbook data:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...entries];

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(entry => entry.type === filterType);
        }

        // Filter by category (for expenses)
        if (filterCategory !== 'all') {
            filtered = filtered.filter(entry => entry.category === filterCategory || !entry.category);
        }

        // Filter by GST type
        if (gstFilter !== 'all') {
            filtered = filtered.filter(entry => {
                if (entry.type === 'sale' || entry.type === 'purchase') {
                    const hasGST = entry.details?.totalTax > 0;
                    if (gstFilter === 'gst') return hasGST;
                    if (gstFilter === 'non-gst') return !hasGST;
                }
                return true; // Include expenses and returns regardless of GST filter
            });
        }

        // Filter by date range
        if (dateRange.start) {
            filtered = filtered.filter(entry => new Date(entry.date) >= new Date(dateRange.start));
        }
        if (dateRange.end) {
            filtered = filtered.filter(entry => new Date(entry.date) <= new Date(dateRange.end));
        }

        // Sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        // Recalculate running balance for filtered entries
        let runningBalance = 0;
        const filteredWithBalance = filtered.map(entry => {
            runningBalance += entry.amount;
            return {
                ...entry,
                balance: runningBalance,
            };
        });

        setFilteredEntries(filteredWithBalance);
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'sale':
            case 'payment':
                return <TrendingUp className="h-4 w-4 text-green-600" />;
            case 'purchase':
                return <TrendingDown className="h-4 w-4 text-red-600" />;
            case 'expense':
                return <Minus className="h-4 w-4 text-orange-600" />;
            case 'return':
                return <ArrowUpDown className="h-4 w-4 text-blue-600" />;
            default:
                return <BookOpen className="h-4 w-4" />;
        }
    };

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case 'sale':
            case 'payment':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'purchase':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            case 'expense':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
            case 'return':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
        }
    };

    const totalIncome = entries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = Math.abs(entries.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0));
    const netBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;

    const categories = [...new Set(entries.filter(e => e.category).map(e => e.category!))];

    const exportToExcel = () => {
        const data = filteredEntries.map(entry => ({
            Date: formatDate(entry.date),
            Type: entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
            Description: entry.description,
            Amount: entry.amount,
            Category: entry.category || 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Passbook');
        XLSX.writeFile(wb, 'passbook.xlsx');
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                        <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                        Passbook
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">Complete financial transaction history</p>
                </div>
                <Button variant="outline" onClick={exportToExcel} className="self-start sm:self-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Export to Excel
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-semibold text-green-700">Total Income</CardTitle>
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600 mb-1">{formatCurrency(totalIncome)}</div>
                        <p className="text-xs text-muted-foreground">
                            Money received from sales
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-semibold text-red-700">Total Expenses</CardTitle>
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600 mb-1">{formatCurrency(totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground">
                            Money spent on purchases & expenses
                        </p>
                    </CardContent>
                </Card>

                <Card className={`border-2 shadow-md hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1 ${netBalance >= 0 ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-white' : 'border-red-200 bg-gradient-to-br from-red-50 to-white'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className={`text-sm font-semibold ${netBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                            Net Balance
                        </CardTitle>
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${netBalance >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                            <BookOpen className={`h-5 w-5 ${netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold mb-1 ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(netBalance)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Current account balance
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border shadow-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Filter className="h-5 w-5 text-primary" />
                        Filters & Search
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="font-medium">Transaction Type</Label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="h-11 border-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="sale">Sales (+)</SelectItem>
                                    <SelectItem value="payment">Collections (+)</SelectItem>
                                    <SelectItem value="purchase">Purchases (-)</SelectItem>
                                    <SelectItem value="expense">Expenses (-)</SelectItem>
                                    <SelectItem value="return">Returns (-)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-medium">Category</Label>
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="h-11 border-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(category => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-medium">GST Type</Label>
                            <Select value={gstFilter} onValueChange={setGstFilter}>
                                <SelectTrigger className="h-11 border-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Transactions</SelectItem>
                                    <SelectItem value="gst">GST Transactions</SelectItem>
                                    <SelectItem value="non-gst">Non-GST Transactions</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                            <Label className="font-medium">Start Date</Label>
                            <Input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="h-11 border-2"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-medium">End Date</Label>
                            <Input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="h-11 border-2"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-6">
                        <Button
                            variant="outline"
                            size="default"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="gap-2 flex-1 sm:flex-none"
                        >
                            <ArrowUpDown className="h-4 w-4" />
                            {sortOrder === 'asc' ? 'Old to New' : 'New to Old'}
                        </Button>
                        <Button
                            variant="outline"
                            size="default"
                            onClick={() => {
                                setFilterType('all');
                                setFilterCategory('all');
                                setGstFilter('all');
                                setDateRange({ start: '', end: '' });
                            }}
                            className="gap-2 flex-1 sm:flex-none"
                        >
                            Clear Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Transaction History */}
            <Card className="border shadow-md">
    <CardHeader className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-b">
        <CardTitle className="text-xl">Transaction History</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
            {filteredEntries.length}{" "}
            {filteredEntries.length === 1 ? "entry" : "entries"}
        </p>
    </CardHeader>

    <CardContent className="p-0">
        {filteredEntries.length === 0 ? (
            <div className="text-center py-12 px-4">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium text-foreground mb-2">
                    No transactions found
                </p>
                <p className="text-sm text-muted-foreground">
                    Try adjusting your filters to see more results
                </p>
            </div>
        ) : (
            /* 👇 SCROLL CONTAINER (MOBILE FIX) */
            <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                    <thead className="bg-muted/30">
                        <tr className="border-b">
                            <th className="text-left p-4 font-semibold text-sm">
                                Date
                            </th>
                            <th className="text-left p-4 font-semibold text-sm">
                                Type
                            </th>
                            <th className="text-left p-4 font-semibold text-sm">
                                Description
                            </th>
                            <th className="text-right p-4 font-semibold text-sm">
                                Amount
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y">
                        {filteredEntries.map((entry) => (
                            <tr
                                key={entry.id}
                                className="hover:bg-muted/20 transition-colors"
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">
                                            {formatDate(entry.date)}
                                        </span>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                            {getTypeIcon(entry.type)}
                                        </div>
                                        <Badge
                                            className={`text-xs ${getTypeBadgeColor(
                                                entry.type
                                            )}`}
                                        >
                                            {entry.type}
                                        </Badge>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <p className="text-sm font-medium text-foreground">
                                        {entry.description}
                                    </p>
                                    {entry.category && (
                                        <Badge
                                            variant="outline"
                                            className="text-xs mt-1"
                                        >
                                            {entry.category}
                                        </Badge>
                                    )}
                                </td>

                                <td className="p-4 text-right">
                                    <span
                                        className={`font-bold text-base ${
                                            entry.amount >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        {entry.amount >= 0 ? "+" : ""}
                                        {formatCurrency(entry.amount)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </CardContent>
</Card>

        </div>
    );
}