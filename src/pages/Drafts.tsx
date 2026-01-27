import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Draft } from '../types';
import { FileText, Trash2, AlertCircle, Edit } from 'lucide-react';
import Layout from '../components/Layout';

export default function Drafts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrafts();
  }, [user]);

  const loadDrafts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Error loading drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('drafts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
      alert('Failed to delete draft');
    }
  };

  const resumeDraft = (draft: Draft) => {
    // Pass the draft data to the schedule page via state
    navigate('/schedule', { state: { draft } });
  };

  const getCompletionPercentage = (draft: Draft) => {
    const fields = [
      draft.integration_id,
      draft.video_id,
      draft.title,
      draft.description,
      draft.platform,
    ];
    const filledFields = fields.filter(f => f).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Drafts</h1>
          <p className="text-slate-600">Resume working on your saved drafts</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : drafts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No drafts</h3>
            <p className="text-slate-600">Your saved drafts will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((draft) => {
              const completion = getCompletionPercentage(draft);
              return (
                <div key={draft.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-slate-100 p-3 rounded-lg">
                      <FileText className="w-6 h-6 text-slate-600" />
                    </div>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    {draft.title || 'Untitled Draft'}
                  </h3>

                  {draft.description && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                      {draft.description}
                    </p>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-600">Completion</span>
                      <span className="font-semibold text-slate-900">{completion}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      Updated {new Date(draft.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => resumeDraft(draft)}
                      className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      Resume
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}