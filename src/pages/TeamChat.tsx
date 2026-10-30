import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, X, Paperclip, MessageCircle, Circle, MoreVertical, Trash2, RotateCcw, ArrowLeft, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { roleNames } from '@/types/auth';
import { castToAdminProfiles } from '@/utils/adminTypeCasting';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: { name: string; role: string; avatar?: string };
}

interface AdminProfile {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

const TeamChat: React.FC = () => {
  const { adminProfile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  useEffect(() => {
    fetchMessages();
    fetchAdmins();
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => fetchMessages())
      .subscribe();
    updateLastLogin();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const updateLastLogin = async () => {
    if (!adminProfile) return;
    await supabase.from('admins').update({ last_login: new Date().toISOString() }).eq('id', adminProfile.id);
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, sender:admins!sender_id(name, role, avatar)')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch (error) { console.error('Error fetching messages:', error); }
    finally { setIsLoading(false); }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase.from('admins').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      setAdmins(castToAdminProfiles(data || []) as any);
    } catch (error) { console.error('Error fetching admins:', error); }
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || message;
    if (!msgText.trim() || !adminProfile) return;
    try {
      const { error } = await supabase.from('chat_messages').insert({ sender_id: adminProfile.id, message: msgText.trim() } as any);
      if (error) throw error;
      if (!text) setMessage('');
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
  };

  const deleteMessage = async (msgId: string) => {
    try {
      const { error } = await supabase.from('chat_messages').delete().eq('id', msgId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast({ title: 'Deleted', description: 'Message deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const resendMessage = async (msg: ChatMessage) => { await sendMessage(msg.message); };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !adminProfile) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid File', description: 'Please select an image', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `chat_images/${adminProfile.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
      await supabase.from('chat_messages').insert({ sender_id: adminProfile.id, message: `📷 ${publicUrl}` } as any);
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: 'Failed to upload image', variant: 'destructive' });
    } finally { setUploading(false); if (event.target) event.target.value = ''; }
  };

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatDate = (date: string) => {
    const msgDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRoleBadgeColor = (role: string) => {
    const m: Record<string, string> = {
      super_admin: 'bg-red-500/20 text-red-300', hr_admin: 'bg-blue-500/20 text-blue-300',
      tech_admin: 'bg-green-500/20 text-green-300', content_admin: 'bg-purple-500/20 text-purple-300',
      social_admin: 'bg-pink-500/20 text-pink-300', esports_admin: 'bg-orange-500/20 text-orange-300',
    };
    return m[role] || 'bg-muted text-muted-foreground';
  };

  const isOnline = (lastLogin: string | null, id: string) => {
    if (adminProfile && id === adminProfile.id) return true;
    if (!lastLogin) return false;
    return (Date.now() - new Date(lastLogin).getTime()) / 60000 < 10;
  };

  const groupedMessages = messages.reduce((groups: Record<string, ChatMessage[]>, msg) => {
    const date = formatDate(msg.created_at);
    (groups[date] = groups[date] || []).push(msg);
    return groups;
  }, {});

  const isImageMessage = (msg: string) => msg.startsWith('📷 ');
  const getImageUrl = (msg: string) => msg.replace('📷 Shared an image: ', '').replace('📷 ', '');

  const onlineCount = admins.filter(a => isOnline(a.last_login, a.id)).length;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        {showMembers && isMobile ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMembers(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        ) : (
          <div className="p-2 rounded-full bg-primary/10">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {showMembers && isMobile ? 'Team Members' : 'Team Chat'}
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
            {onlineCount} online
          </p>
        </div>
        {!showMembers && (
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setShowMembers(true)}>
            <Users className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Members sidebar */}
        {((isMobile && showMembers) || !isMobile) && (
          <div className={`${isMobile ? 'w-full' : 'w-64 border-r border-border'} bg-card/50 overflow-y-auto shrink-0`}>
            <div className="p-3 space-y-1">
              {admins.map(admin => (
                <div key={admin.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200 hover:scale-[1.02]">
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={admin.avatar || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                        {admin.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline(admin.last_login, admin.id) ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{admin.name}</p>
                    <p className={`text-[10px] ${isOnline(admin.last_login, admin.id) ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {isOnline(admin.last_login, admin.id) ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat area */}
        {(!isMobile || !showMembers) && (
          <div className="flex-1 flex flex-col min-w-0">
            <ScrollArea className="flex-1 px-3 py-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-muted-foreground text-sm">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start chatting!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date}>
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-full">{date}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      {msgs.map((msg) => {
                        const isOwn = msg.sender_id === adminProfile?.id;
                        const isImg = isImageMessage(msg.message);
                        return (
                          <div key={msg.id} className={`flex gap-2 mb-2 ${isOwn ? 'flex-row-reverse' : ''} group`}>
                            {!isOwn && (
                              <Avatar className="h-7 w-7 mt-1 shrink-0">
                                <AvatarImage src={msg.sender?.avatar} />
                                <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                                  {msg.sender?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                              {!isOwn && (
                                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                                  <span className="text-[11px] font-medium text-foreground">{msg.sender?.name || 'Unknown'}</span>
                                  <span className={`text-[9px] px-1.5 py-0 rounded-full ${getRoleBadgeColor(msg.sender?.role || '')}`}>
                                    {roleNames[msg.sender?.role as keyof typeof roleNames]?.split(' ')[0] || ''}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-end gap-1">
                                <div className={`relative rounded-2xl px-3 py-2 text-sm transition-all duration-200 ${
                                  isOwn
                                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                                    : 'bg-muted text-foreground rounded-bl-sm'
                                }`}>
                                  {isImg ? (
                                    <img
                                      src={getImageUrl(msg.message)}
                                      alt="Shared"
                                      className="max-w-[200px] sm:max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setSelectedImage(getImageUrl(msg.message))}
                                    />
                                  ) : (
                                    <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.message}</p>
                                  )}
                                </div>
                                {/* Actions - three dot, hover shows time */}
                                {isOwn && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0 hover:bg-muted">
                                        <MoreVertical className="w-3 h-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-36">
                                      <div className="px-2 py-1.5 text-[10px] text-muted-foreground border-b border-border">
                                        Sent at {formatTime(msg.created_at)}
                                      </div>
                                      <DropdownMenuItem onClick={() => resendMessage(msg)} className="text-xs gap-2 cursor-pointer hover:bg-primary/10 transition-colors">
                                        <RotateCcw className="w-3 h-3" /> Resend
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => deleteMessage(msg.id)} className="text-xs gap-2 text-destructive cursor-pointer hover:bg-destructive/10 transition-colors">
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                              {/* Time only visible on hover for non-own messages */}
                              {!isOwn && (
                                <span className="text-[10px] text-muted-foreground mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  {formatTime(msg.created_at)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="px-3 py-2 border-t border-border bg-card/80 shrink-0">
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="img-upload" disabled={uploading} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 hover:bg-primary/10 transition-colors" onClick={() => document.getElementById('img-upload')?.click()} disabled={uploading}>
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Input
                  placeholder="Message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  className="h-9 bg-muted/50 border-border rounded-full text-sm px-4"
                />
                <Button
                  onClick={() => sendMessage()}
                  size="icon"
                  className="h-9 w-9 rounded-full bg-primary shrink-0 hover:scale-105 transition-transform"
                  disabled={!message.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-black/95 border-border">
          <DialogClose className="absolute right-4 top-4 z-10 rounded-full p-2 bg-white/10 hover:bg-white/20">
            <X className="h-5 w-5 text-white" />
          </DialogClose>
          {selectedImage && <img src={selectedImage} alt="Full view" className="w-full h-full object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamChat;
