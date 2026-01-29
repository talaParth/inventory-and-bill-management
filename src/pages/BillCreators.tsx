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
import { getCompanyProfile, getBills, getSampleBills } from "@/lib/storage";
import { Bill, SampleBill, CompanyProfile } from "@/types";
import { User, Receipt, ArrowLeft, Search, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/billUtils";

export default function BillCreators() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<string[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [creatorBills, setCreatorBills] = useState<(Bill | SampleBill)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const profile = await getCompanyProfile();
      if (profile?.billCreators) {
        setCreators(profile.billCreators);
      }
      setLoading(false);
    };
    loadData();
  }, []);

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
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <User className="h-6 w-6 text-primary" />
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
            <p className="text-muted-foreground">No creators found. Add them in Settings.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/settings')}
            >
              Go to Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
