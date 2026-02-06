import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Briefcase } from "lucide-react";
import { toast } from "sonner";
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

  const handleAnalyseBusiness = async () => {
    setIsLoading(true);
    try {
      const businessData = await getBusinessDataForAI();
      
      const systemPrompt = `You are an expert Business Consultant and Growth Strategist. 
Analyze the provided business data carefully.
Identify:
1. Critical mistakes in financial management (e.g., high pending payments, low margins).
2. Growth opportunities based on top clients and sales trends.
3. Inventory and expense optimization.
Provide actionable recommendations.

Business Data:
${JSON.stringify(businessData, null, 2)}`;

      const initialMessage: Message = {
        role: "user",
        content: "Analyze my business data and provide a detailed growth strategy and mistake analysis.",
      };
      
      setMessages([initialMessage]);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.AI_INTEGRATIONS_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.1',
          messages: [
            { role: "system", content: systemPrompt },
            initialMessage
          ],
          temperature: 0.7,
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
        setIsAnalyzed(true);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to connect to AI Agent. Please try again.");
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const businessData = await getBusinessDataForAI();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.AI_INTEGRATIONS_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.1',
          messages: [
            { role: "system", content: "You are an expert business consultant. Keep context of the business data: " + JSON.stringify(businessData) },
            ...newMessages
          ],
          temperature: 0.7,
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
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto">
      <Card className="flex-1 flex flex-col overflow-hidden shadow-xl border-primary/10">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Business Agent
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0 relative">
          <ScrollArea ref={scrollAreaRef} className="h-full p-4">
            <div className="space-y-4">
              {messages.length === 0 && !isAnalyzed && (
                <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-6">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Briefcase className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Welcome to AI Business Agent</h3>
                    <p className="text-muted-foreground max-w-xs">
                      Click the button below to start analyzing your business and get personalized insights.
                    </p>
                  </div>
                  <Button 
                    size="lg" 
                    onClick={handleAnalyseBusiness}
                    disabled={isLoading}
                    className="gap-2 px-8 py-6 text-lg shadow-lg hover:scale-105 transition-all"
                  >
                    {isLoading ? "Analyzing..." : "Analyse My Business"}
                  </Button>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex gap-3 max-w-[85%] ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div className={`mt-1 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"
                    }`}>
                      {message.role === "user" ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2 shadow-sm ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 border"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && messages.length > 0 && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="mt-1 h-8 w-8 rounded-full bg-muted border flex items-center justify-center">
                      <Bot size={16} className="animate-pulse" />
                    </div>
                    <div className="bg-muted/50 border rounded-2xl px-4 py-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        {isAnalyzed && (
          <CardFooter className="border-t p-4 bg-muted/10">
            <form onSubmit={handleSendMessage} className="flex w-full gap-2">
              <Input
                placeholder="Ask follow-up questions..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
