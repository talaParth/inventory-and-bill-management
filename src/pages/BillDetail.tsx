import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBills } from '@/lib/storage';
import { Bill } from '@/types';
import { BillView } from '@/components/BillView';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);

  useEffect(() => {
    const loadBill = async () => {
      if (id) {
        const bills = await getBills();
        const foundBill = bills.find((b) => b.id === id);
        if (foundBill) {
          setBill(foundBill);
        } else {
          navigate('/bills');
        }
      }
    };
    loadBill();
  }, [id, navigate]);

  if (!bill) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <Button variant="outline" onClick={() => navigate('/bills')} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bills
        </Button>
        <Link to={`/bills/${bill.id}/edit`} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Edit className="h-4 w-4 mr-2" />
            Edit Bill
          </Button>
        </Link>
      </div>

      <BillView bill={bill} />
    </div>
  );
}
