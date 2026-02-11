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

        const systemMessage: Message = {
          role: "system",
          content: `You are a high-level Strategic Business Consultant for "Starlink" GST Software users. 
            Your goal is to provide insightful, professional, and actionable business advice based on data.

            CRITICAL INSTRUCTIONS:
            - NEVER show raw JSON data or technical structures to the user.
            - Always interpret the data into human-friendly business insights.
            - Use a professional yet encouraging tone.
            - Format your response with clear headings, bullet points, and bold text for readability.
            - Focus on growth, efficiency, and financial health.`
        };

        const initialMessage: Message = {
          role: "user",
          content: `Please analyze my current business performance using the following data and provide a strategic report. 

            Context for analysis:
            - Business Name: Starlink GST Software
            - Currency: INR (₹)

            Data to analyze: ${JSON.stringify(systemData)}`,
        };

        const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'api-subscription-key': import.meta.env.VITE_SARVAM_API_KEY || 'sk_cgklaer7_PyVfuZMemeppS9aL53Cvbldg',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sarvam-m',
            messages: [systemMessage, initialMessage],
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
            systemMessage,
            initialMessage,
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
    <div className= "flex flex-col h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto bg-gradient-to-b from-background to-muted/5 p-4 md:p-6" >
    <div className="flex-1 flex flex-col overflow-hidden bg-card rounded-3xl border shadow-xl shadow-primary/5" >
      <div className="border-b bg-primary/5 px-8 py-6 flex items-center justify-between" >
        <div className="flex items-center gap-4" >
          <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20" >
            <Bot className="h-7 w-7 text-primary-foreground" />
              </div>
              < div >
              <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70" > Strategic Business Consultant </h2>
                < div className = "flex items-center gap-2" >
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-sm font-medium text-muted-foreground" > AI Intelligence Active </p>
                      </div>
                      </div>
                      </div>
                      </div>

                      < div className = "flex-1 overflow-hidden relative" >
                        <ScrollArea ref={ scrollAreaRef } className = "h-full px-4 md:px-8 py-6" >
                          <div className="space-y-8 max-w-4xl mx-auto pb-4" >
                            {
                              messages.length === 0 && isLoading && (
                                <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-10 animate-in fade-in zoom-in-95 duration-700">
                                  <div className="relative">
                                    <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping [animation-duration:3s]" />
                                      < div className="relative p-10 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm" >
                                      <Bot className="h-20 w-20 text-primary animate-pulse" />
                                        </div>
                                        </div>
                                        < div className="space-y-4" >
                                        <h3 className="text-3xl font-extrabold tracking-tight"> Synthesizing Business Intelligence</ h3 >
                            <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed" >
                              I'm auditing your financial landscape, inventory efficiency, and growth trajectories to architect a custom strategy.
                                </p>
                                </div>
                                < div className = "flex flex-col items-center gap-6" >
                                  <div className="flex gap-2.5" >
                                    <span className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                      <span className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-3 h-3 bg-primary rounded-full animate-bounce" />
                                          </div>
                                          < div className = "w-64 h-2 bg-muted rounded-full overflow-hidden" >
                                            <div className="w-full h-full bg-primary origin-left animate-[loading_2s_ease-in-out_infinite]" />
                                              </div>
                                              </div>
                                              </div>
                )
}

{
  messages.filter(m =>
    m.role !== 'system' &&
    !(m.role === 'user' && m.content.includes('Please analyze my current business performance'))
  ).map((message, index) => (<div
                    key= { index }
                    className = {`flex ${message.role === "user" ? "justify-end" : "justify-start"
      } animate-in slide-in-from-bottom-4 fade-in duration-500`}
                  >
  <div
                      className={
  `flex gap-4 max-w-[90%] md:max-w-[85%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"
  }`
}
                    >
  <div className={
    `mt-1 flex-shrink-0 h-10 w-10 md:h-12 md:w-12 rounded-2xl flex items-center justify-center shadow-md ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border shadow-inner"
    }`
}>
  { message.role === "user" ? <User size={ 22 } /> : <Bot size={22} className="text-primary" / >}
</div>
  < div
className = {`rounded-3xl px-6 py-4 shadow-sm ${message.role === "user"
    ? "bg-primary text-primary-foreground rounded-tr-none"
    : "bg-muted/30 border border-border/40 rounded-tl-none backdrop-blur-[2px]"
  }`}
                      >
  <div className={
    `prose prose-sm md:prose-base dark:prose-invert max-w-none ${message.role === "user" ? "prose-invert text-primary-foreground" : "text-foreground"
    }`
}>
  <ReactMarkdown remarkPlugins={ [remarkGfm] }>
    { message.content }
    </ReactMarkdown>
    </div>
    </div>
    </div>
    </div>
                ))}
{
  isLoading && messages.length > 0 && (
    <div className="flex justify-start animate-in fade-in duration-300" >
      <div className="flex gap-4 max-w-[90%]" >
        <div className="mt-1 h-12 w-12 rounded-2xl bg-card border shadow-inner flex items-center justify-center" >
          <Bot size={ 22 } className = "animate-pulse text-primary" />
            </div>
            < div className = "bg-muted/30 border border-border/40 rounded-3xl rounded-tl-none px-6 py-4 flex items-center backdrop-blur-[2px]" >
              <div className="flex gap-2" >
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      </div>
                      </div>
                      </div>
                )
}
</div>
  </ScrollArea>
  </div>

{
  isAnalyzed && (
    <div className="border-t bg-card p-6 md:p-8" >
      <div className="max-w-4xl mx-auto" >
        <form onSubmit={ handleSendMessage } className = "flex w-full gap-4" >
          <div className="relative flex-1 group" >
            <Input
                      placeholder="Ask for deeper insights or specific strategy..."
  value = { input }
  onChange = {(e) => setInput(e.target.value)
}
disabled = { isLoading }
className = "h-14 px-8 rounded-2xl border-border bg-muted/30 focus-visible:ring-primary/10 transition-all duration-300 group-hover:bg-muted/50 text-base shadow-inner"
  />
  <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-300" />
    </div>
    < Button type = "submit" size = "lg" className = "h-14 w-14 md:w-auto md:px-8 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all duration-200" disabled = { isLoading || !input.trim()}>
      <Send className="h-5 w-5 md:mr-2" />
        <span className="hidden md:inline" > Analyze </span>
          </Button>
          </form>
          </div>
          </div>
          )}
</div>
  </div>
    );
  }
