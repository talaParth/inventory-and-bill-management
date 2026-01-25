import { getSampleBillById } from "@/lib/firebaseService";
import { SampleBill } from "@/types";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LoadingSpinner } from "./LoadingSpinner";
import { SampleBillView } from "./SampleBillView";
import { Button } from "./ui/button";
import { ArrowLeft, Edit } from "lucide-react";

export function SampleBillViewPage() {
  const { id } = useParams();
  const [bill, setBill] = useState<SampleBill | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadBill = async () => {
      if (id) {
        const data = await getSampleBillById(id);
        setBill(data);
        setLoading(false);
      }
    };
    loadBill();
  }, [id]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (!bill) return <div>Sample bill not found</div>;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <Button
          variant="outline"
          onClick={() => navigate("/sample-bills")}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bills
        </Button>
        <Link to={`/sample-bills/${bill.id}/edit`} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Edit className="h-4 w-4 mr-2" />
            Edit Bill
          </Button>
        </Link>
      </div>
      <SampleBillView bill={bill} />
    </div>
  );
}
