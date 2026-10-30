import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Plus, Trash2, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useActivityLogger, ActivityActions } from '@/hooks/useActivityLogger';

interface Todo {
  id: string;
  title: string;
  is_completed: boolean;
  priority: string;
  due_date: string;
  created_at: string;
}

const DailyTodos = () => {
  const { adminProfile } = useAuth();
  const { logActivity } = useActivityLogger();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    if (adminProfile) {
      fetchTodos();
    }
  }, [adminProfile]);

  const fetchTodos = async () => {
    if (!adminProfile) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('admin_todos')
        .select('*')
        .eq('admin_id', adminProfile.id)
        .eq('due_date', today)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTodos((data || []) as Todo[]);
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTodo = async () => {
    if (!adminProfile || !newTask.trim()) return;

    try {
      const { error } = await supabase
        .from('admin_todos')
        .insert({
          admin_id: adminProfile.id,
          title: newTask.trim(),
          due_date: new Date().toISOString().split('T')[0]
        } as any);

      if (error) throw error;

      await logActivity(ActivityActions.CREATE_TODO, {
        task_title: newTask.trim()
      });

      setNewTask('');
      setShowInput(false);
      fetchTodos();
      toast({ title: 'Task added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleTodo = async (todo: Todo) => {
    try {
      const { error } = await supabase
        .from('admin_todos')
        .update({
          is_completed: !todo.is_completed,
          completed_at: !todo.is_completed ? new Date().toISOString() : null
        } as any)
        .eq('id', todo.id);

      if (error) throw error;

      if (!todo.is_completed) {
        await logActivity(ActivityActions.COMPLETE_TODO, {
          task_title: todo.title
        });
      }

      fetchTodos();
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const deleteTodo = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from('admin_todos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logActivity(ActivityActions.DELETE_TODO, {
        task_title: title
      });

      fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const completedCount = todos.filter((t) => t.is_completed).length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Circular progress ring geometry
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <Card
      className="border overflow-hidden relative rounded-3xl"
      style={{
        background: 'linear-gradient(160deg, #000000ff 0%, #000000ff 100%)',
        borderColor: 'rgba(255, 255, 255, 0.12)'
      }}
    >
      <CardContent className="p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
              <img src="/icons/target.png" alt="Check Square" className="w-10 h-10 text-blue-400" />

            <h3 className="text-xl font-semibold text-blue-400">Today's Tasks</h3>
          </div>
          <Badge
            variant="outline"
            className="text-sm px-3 py-1 rounded-full border-slate-600/60 text-slate-200 font-medium bg-transparent"
          >
            {completedCount}/{totalCount}
          </Badge>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-slate-700/40 mb-6" />

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Progress ring + status */}
            <div className="flex items-center gap-6 mb-6">
              <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                <svg width="160" height="160" viewBox="0 0 160 160">
                  {/* track */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="rgba(254, 255, 255, 0.15)"
                    strokeWidth="8"
                  />
                  {/* tick marks at N/E/S/W */}
                  {[0, 90, 180, 270].map((deg) => (
                    <line
                      key={deg}
                      x1="80"
                      y1="6"
                      x2="80"
                      y2="16"
                      stroke="rgba(255, 255, 255, 0.35)"
                      strokeWidth="2"
                      transform={`rotate(${deg} 80 80)`}
                    />
                  ))}
                  {/* progress */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#ffffffff"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{progress}%</span>
                  <span className="text-sm text-slate-400 font-medium">Complete</span>
                </div>
              </div>

              <div className="flex-1">
                {totalCount === 0 ? (
                  <>
                    <p className="text-2xl font-bold text-white mb-1">You're all caught up!</p>
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      No tasks for today. Add one to get started.
                    </p>
                  </>
                ) : completedCount === totalCount ? (
                  <>
                    <p className="text-2xl font-bold text-white mb-1">All done for today!</p>
                    <p className="text-sm text-slate-400">
                      You completed all {totalCount} task{totalCount > 1 ? 's' : ''}. Nice work.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-white mb-1">Keep going!</p>
                    <p className="text-sm text-slate-400">
                      {totalCount - completedCount} task{totalCount - completedCount > 1 ? 's' : ''} left to complete today.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Task list */}
            {totalCount > 0 && (
              <div className="space-y-2 max-h-[220px] overflow-y-auto mb-4 pr-1">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-2.5 p-3 rounded-xl transition-all duration-200 group border ${
                      todo.is_completed
                        ? 'bg-blue-500/10 border-blue-500/25'
                        : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60'
                    }`}
                  >
                    <button
                      onClick={() => toggleTodo(todo)}
                      className="flex-shrink-0 transition-transform duration-200 hover:scale-110"
                    >
                      {todo.is_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm font-medium ${
                        todo.is_completed ? 'line-through text-slate-500' : 'text-slate-100'
                      }`}
                    >
                      {todo.title}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id, todo.title)}
                      className="p-1 hover:bg-red-500/20 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add task */}
            {showInput ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Add a task..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                  onBlur={() => !newTask.trim() && setShowInput(false)}
                  className="bg-slate-900/80 border-slate-700/50 text-sm h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20"
                />
                <button
                  onClick={addTodo}
                  className="px-5 rounded-xl font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #000000ff 0%, #000000ff 100%)' }}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-base transition-all duration-200 hover:brightness-110 active:scale-[0.98] shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #000001ff 0%, #1d4ed8 100%)',
                  boxShadow: '0 8px 24px -8px rgba(255, 255, 255, 0.5)'
                }}
              >
                <Plus className="w-5 h-5" />
                Add New Task
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyTodos;