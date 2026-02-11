import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  getBills, 
  getProducts, 
  getPurchaseBills, 
  getExpenses, 
  getInventoryTransactions, 
  getBillReturns, 
  getDeadstock, 
  getClients, 
  getCompanyProfile, 
  getNotes 
} from "@/lib/firebaseService";
import { getBusinessDataForAI } from "@/lib/businessDataCollector";


  interface Message {
    role: "user" | "assistant" | "system";
    content: string;
  }

  export default function AIAgent() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzed, setIsAnalyzed] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    };

    useEffect(() => {
      scrollToBottom();
    }, [messages]);

    useEffect(() => {
      const autoAnalyse = async () => {
        if (isAnalyzed || isLoading) return;

        setIsLoading(true);
        try {
          // Fetch ALL business data
          const [
            bills, 
            products, 
            purchaseBills, 
            expenses, 
            inventoryTransactions,
            billReturns,
            deadstock,
            clients,
            profile,
            notes
          ] = await Promise.all([
            getBills(),
            getProducts(),
            getPurchaseBills(),
            getExpenses(),
            getInventoryTransactions(),
            getBillReturns(),
            getDeadstock(),
            getClients(),
            getCompanyProfile(),
            getNotes()
          ]);

          const systemData = {
            summary: {
              totalSales: bills.reduce((sum, b) => sum + b.total, 0),
              totalPurchases: purchaseBills.reduce((sum, b) => sum + b.total, 0),
              totalExpenses: expenses.reduce((sum, b) => sum + b.amount, 0),
              stockValue: products.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0),
              itemCount: products.length,
              clientCount: clients.length,
              totalReturns: billReturns.length,
              returnAmount: billReturns.reduce((sum, r) => sum + r.totalReturnValue, 0)
            },
            allBillDetails: bills.map(b => ({
              id: b.billNumber,
              date: b.date,
              client: b.client?.name || (b as any).clientName,
              total: b.total,
              items: b.items.map(i => ({ name: i.productName, qty: i.quantity, rate: i.ratePerUnit })),
              status: b.paymentStatus
            })),
            clientWiseAnalysis: clients.map(c => {
              const clientBills = bills.filter(b => (b.client?.id === c.id) || ((b as any).clientName === c.name));
              const clientReturns = billReturns.filter(r => r.clientName === c.name);
              return {
                name: c.name,
                totalSales: clientBills.reduce((sum, b) => sum + b.total, 0),
                totalReturns: clientReturns.reduce((sum, r) => sum + r.totalReturnValue, 0),
                pendingAmount: clientBills.reduce((sum, b) => sum + (b.total - (b.paidAmount || 0)), 0)
              };
            }),
            purchaseExpenses: purchaseBills.map(p => ({
              vendor: p.vendorName,
              total: p.total,
              items: p.items.map(i => ({ name: i.description, qty: i.quantity, rate: i.rate })),
              date: p.billDate || p.createdAt
            })),
            inventoryStatus: products
              .map(p => ({
                name: p.name,
                stock: p.stock,
                price: p.sellingPrice,
                purchase: p.purchasePrice
              })),
            recentNotes: notes.slice(-10).map(n => n.content)
          };

          const initialMessage: Message = {
            role: "user",
            content: `You are a professional Business Growth Consultant for "Starlink" GST Software. 
            Analyze the following business data and provide a clear, supportive, and professional analysis for the owner.

            Guidelines:
            - Use Indian Rupees (₹) for all currency.
            - Use simple, friendly language.
            - Format with Markdown (headings, bold text, lists).
            - Be constructive and offer real advice.

            Report Structure:
            1. **Business Snapshot**: Overview of current performance.
            2. **Financial Health**: Sales, Purchases, and Expenses breakdown.
            3. **Inventory & Stock**: Stock levels, deadstock, and moving items.
            4. **Customer Insights**: Top performing clients.
            5. **Growth Strategy**: 3 actionable steps to improve profitability.
            6. **Risk Report**: Pending payments and potential issues.

            Business Data: ${JSON.stringify(systemData)}`,
          };

          const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'api-subscription-key': import.meta.env.VITE_SARVAM_API_KEY || 'sk_cgklaer7_PyVfuZMemeppS9aL53Cvbldg',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sarvam-m',
              messages: [initialMessage],
              temperature: 0.7,
              max_tokens: 2000,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to fetch response from AI');
          }

          const data = await response.json();
          if (data && data.choices && data.choices[0]) {
            setMessages([
              {
                role: "assistant",
                content: data.choices[0].message.content
              }
            ]);
            setIsAnalyzed(true);
          }
        } catch (error) {
          console.error('Error:', error);
          toast.error("Failed to connect to AI Agent. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };

      autoAnalyse();
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = { role: "user", content: input };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);

      try {
        const messagesForAPI = messages.length === 0 
          ? [userMessage]
          : [...messages, userMessage];

        const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'api-subscription-key': import.meta.env.VITE_SARVAM_API_KEY || 'sk_cgklaer7_PyVfuZMemeppS9aL53Cvbldg',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sarvam-m',
            messages: messagesForAPI,
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch response from AI');
        }

        const data = await response.json();
        if (data && data.choices && data.choices[0]) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: data.choices[0].message.content
          }]);
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error("Failed to send message. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] w-full max-w-5xl mx-auto bg-background">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b bg-muted/20 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">AI Business Agent</h2>
              <p className="text-xs text-muted-foreground">Powered by Sarvam AI • Real-time Business Intelligence</p>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <ScrollArea ref={scrollAreaRef} className="h-full px-6 py-4">
              <div className="space-y-6 max-w-4xl mx-auto">
                {messages.length === 0 && isLoading && (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-8 animate-in fade-in duration-500">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                      <div className="relative p-6 rounded-full bg-primary/10">
                        <Bot className="h-16 w-16 text-primary" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold">Analyzing Your Business Data</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                        I'm processing your sales, inventory, purchases, and expenses to generate comprehensive insights and growth strategies.
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    } animate-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`flex gap-4 max-w-[90%] ${
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div className={`mt-1 flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${
                        message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
                      }`}>
                        {message.role === "user" ? <User size={20} /> : <Bot size={20} />}
                      </div>
                      <div
                        className={`rounded-2xl px-5 py-3 shadow-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 border border-border/50"
                        }`}
                      >
                        <div className={`prose prose-sm dark:prose-invert max-w-none ${
                          message.role === "user" ? "prose-invert text-primary-foreground" : "text-foreground"
                        }`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && messages.length > 0 && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div className="flex gap-4 max-w-[90%]">
                      <div className="mt-1 h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center">
                        <Bot size={20} className="animate-pulse text-primary" />
                      </div>
                      <div className="bg-muted/40 border border-border/50 rounded-2xl px-5 py-3 flex items-center">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {isAnalyzed && (
            <div className="border-t bg-background p-6">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSendMessage} className="flex w-full gap-3">
                  <Input
                    placeholder="Ask follow-up questions about your business..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 h-12 px-6 rounded-xl border-border bg-muted/20 focus-visible:ring-primary/20"
                  />
                  <Button type="submit" size="icon" className="h-12 w-12 rounded-xl shadow-lg" disabled={isLoading || !input.trim()}>
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
