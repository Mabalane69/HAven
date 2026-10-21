import React, { useState, useEffect } from 'react';
import {
  Users,
  Heart,
  MessageSquare,
  Plus,
  Send,
  Shield,
  Sparkles,
  MapPin,
  CheckCircle2,
  Lightbulb,
  Compass,
  Smile,
  Bell,
  Coffee,
  X,
  Lock,
} from 'lucide-react';
import type { SharedStory, CommunityCircle, UserProfile } from '../types';
import { api } from '../services/api';

interface StoriesAndCommunitiesProps {
  user: UserProfile;
}

const STORY_CATEGORIES = [
  'ALL',
  'First Dates & Romance',
  'Solo Dates & Self-Love',
  'Couples Outings',
  'Healing & Vulnerability',
];

export const StoriesAndCommunities: React.FC<StoriesAndCommunitiesProps> = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState<'stories' | 'circles'>('stories');
  const [stories, setStories] = useState<SharedStory[]>([]);
  const [circles, setCircles] = useState<CommunityCircle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Submit Story Modal
  const [isSubmitStoryOpen, setIsSubmitStoryOpen] = useState<boolean>(false);
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyCategory, setStoryCategory] = useState<string>('First Dates & Romance');
  const [storyType, setStoryType] = useState<'FIRST_DATE' | 'SOLO_DATE' | 'COUPLES_OUTING' | 'HEALING_JOURNEY'>('FIRST_DATE');
  const [locationOrVibe, setLocationOrVibe] = useState<string>('');
  const [storyChallenge, setStoryChallenge] = useState<string>('');
  const [storyTurningPoint, setStoryTurningPoint] = useState<string>('');
  const [storyTakeaway, setStoryTakeaway] = useState<string>('');
  const [isAnonymousStory, setIsAnonymousStory] = useState<boolean>(false);

  // Story Comments
  const [storyCommentInputs, setStoryCommentInputs] = useState<Record<string, string>>({});
  const [expandedCommentsStoryId, setExpandedCommentsStoryId] = useState<string | null>(null);

  // Community Circle Posts
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [isAnonymousPost, setIsAnonymousPost] = useState<boolean>(true);
  const [postError, setPostError] = useState<string | null>(null);

  // Circle Comments
  const [circleCommentInputs, setCircleCommentInputs] = useState<Record<string, string>>({});

  // Suggest Community Modal (User)
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState<boolean>(false);
  const [suggestName, setSuggestName] = useState<string>('');
  const [suggestCategory, setSuggestCategory] = useState<string>('Dating & Romance');
  const [suggestDescription, setSuggestDescription] = useState<string>('');
  const [suggestPrompt, setSuggestPrompt] = useState<string>('');
  const [suggestSuccess, setSuggestSuccess] = useState<boolean>(false);

  // Admin Add Topic Modal (Admin only)
  const [isAdminCreateTopicOpen, setIsAdminCreateTopicOpen] = useState<boolean>(false);
  const [newTopicName, setNewTopicName] = useState<string>('');
  const [newTopicCategory, setNewTopicCategory] = useState<string>('Connection & Dates');
  const [newTopicDescription, setNewTopicDescription] = useState<string>('');
  const [newTopicPrompt, setNewTopicPrompt] = useState<string>('');

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storyData, circleData] = await Promise.all([api.getStories(), api.getCommunities()]);
      setStories(storyData);
      setCircles(circleData);
      setSelectedCircleId((selected) => circleData.some((circle) => circle.id === selected)
        ? selected
        : circleData[0]?.id || '');
    } catch (err) {
      console.error('Load community data error:', err);
    }
  };

  // Support a story (Like / "You're Not Alone")
  const handleSupportStory = async (id: string) => {
    try {
      const updated = await api.toggleStorySupport(id);
      setStories((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      console.error('Support story error:', err);
    }
  };

  // Join a story thread (Participate & receive notifications)
  const handleJoinStory = async (id: string) => {
    try {
      const updated = await api.joinStory(id);
      setStories((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      console.error('Join story error:', err);
    }
  };

  // Add comment to a story
  const handleAddStoryComment = async (storyId: string) => {
    const text = storyCommentInputs[storyId]?.trim();
    if (!text) return;

    try {
      const res = await api.addStoryComment(storyId, {
        content: text,
        isAnonymous: false,
      });

      if (res.story) {
        setStories((prev) => prev.map((s) => (s.id === storyId ? res.story : s)));
      }
      setStoryCommentInputs({ ...storyCommentInputs, [storyId]: '' });
    } catch (err) {
      console.error('Add story comment error:', err);
    }
  };

  // Create new shared story
  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyTitle || !storyChallenge || !storyTurningPoint || !storyTakeaway) return;

    try {
      const created = await api.submitStory({
        title: storyTitle,
        category: storyCategory,
        storyType,
        locationOrVibe,
        authorAlias: isAnonymousStory ? 'Anonymous Friend' : user.name,
        authorContext: user.culturalContext || '',
        challenge: storyChallenge,
        turningPoint: storyTurningPoint,
        keyTakeaway: storyTakeaway,
        tags: [storyCategory.split('&')[0].trim(), storyType.replace('_', ' ')],
      });

      setStories([created, ...stories]);
      setIsSubmitStoryOpen(false);
      setStoryTitle('');
      setLocationOrVibe('');
      setStoryChallenge('');
      setStoryTurningPoint('');
      setStoryTakeaway('');
    } catch (err) {
      console.error('Submit story error:', err);
    }
  };

  // Join a Community Circle
  const handleJoinCircle = async (circleId: string) => {
    try {
      const updated = await api.joinCommunity(circleId);
      setCircles((prev) => prev.map((c) => (c.id === circleId ? updated : c)));
    } catch (err) {
      console.error('Join circle error:', err);
    }
  };

  // Admin creates a new Circle/Topic
  const handleAdminCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName || !newTopicDescription) return;

    try {
      const created = await api.adminCreateCircle({
        name: newTopicName,
        category: newTopicCategory,
        description: newTopicDescription,
        initialDiscussionPrompt: newTopicPrompt,
      });

      setCircles([created, ...circles]);
      setSelectedCircleId(created.id);
      setIsAdminCreateTopicOpen(false);
      setNewTopicName('');
      setNewTopicDescription('');
      setNewTopicPrompt('');
    } catch (err: any) {
      alert(err.message || 'Failed to create circle topic');
    }
  };

  // User suggests a community
  const handleSuggestCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestName || !suggestDescription) return;

    try {
      await api.suggestCommunity({
        name: suggestName,
        category: suggestCategory,
        description: suggestDescription,
        proposedFirstDiscussion: suggestPrompt,
      });

      setIsSuggestModalOpen(false);
      setSuggestSuccess(true);
      setSuggestName('');
      setSuggestDescription('');
      setSuggestPrompt('');
      setTimeout(() => setSuggestSuccess(false), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit proposal');
    }
  };

  // Community Circle Posts
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;

    setPostError(null);
    try {
      const res = await api.createPost(selectedCircleId, {
        title: newPostTitle,
        content: newPostContent,
        isAnonymous: isAnonymousPost,
        tags: ['Peer Support'],
      });

      if (res.error) {
        setPostError(res.error);
        return;
      }

      setCircles((prev) =>
        prev.map((c) => {
          if (c.id === selectedCircleId) {
            return {
              ...c,
              posts: [res.post, ...c.posts],
            };
          }
          return c;
        })
      );

      setNewPostTitle('');
      setNewPostContent('');
      setIsCreatePostOpen(false);
    } catch (err: any) {
      setPostError(err.message || 'Failed to submit post.');
    }
  };

  const handleAddCircleComment = async (postId: string) => {
    const text = circleCommentInputs[postId]?.trim();
    if (!text) return;

    try {
      const res = await api.addComment(postId, {
        content: text,
        isAnonymous: false,
      });

      if (res.error) {
        alert(res.error);
        return;
      }

      setCircles((prev) =>
        prev.map((c) => ({
          ...c,
          posts: c.posts.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                comments: [...p.comments, res.comment],
              };
            }
            return p;
          }),
        }))
      );

      setCircleCommentInputs({ ...circleCommentInputs, [postId]: '' });
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const handleSupportPost = async (postId: string) => {
    try {
      const res = await api.togglePostSupport(postId);
      if (res.post) {
        setCircles((prev) =>
          prev.map((c) => ({
            ...c,
            posts: c.posts.map((p) => (p.id === postId ? res.post : p)),
          }))
        );
      }
    } catch (err) {
      console.error('Post support error:', err);
    }
  };

  const activeCircle = circles.find((c) => c.id === selectedCircleId) || circles[0];

  const filteredStories = stories.filter((s) => {
    if (selectedCategory === 'ALL') return true;
    return s.category.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Suggestion Success Alert */}
      {suggestSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Thank you! Your community topic suggestion was sent directly to our clinical admin review queue.
          </span>
        </div>
      )}

      {/* Sub-navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EAE3D9] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#2A2421] font-serif">
            Peer Sanctuary: Shared Journeys & Community Circles
          </h2>
          <p className="text-xs text-[#6B5E57] mt-0.5">
            Real stories about first dates, solo date ideas, couples outings, and safe community topics.
          </p>
        </div>

        {/* Sub-tab Pill Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#EAE3D9]/60 rounded-xl shrink-0">
          <button
            onClick={() => setActiveSubTab('stories')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'stories'
                ? 'bg-white text-[#2A2421] shadow-xs'
                : 'text-[#6B5E57] hover:text-[#2A2421]'
            }`}
          >
            Stories & Date Outings
          </button>
          <button
            onClick={() => setActiveSubTab('circles')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'circles'
                ? 'bg-white text-[#2A2421] shadow-xs'
                : 'text-[#6B5E57] hover:text-[#2A2421]'
            }`}
          >
            Community Circles & Topics
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. STORIES & DATE OUTINGS TAB                                   */}
      {/* ============================================================== */}
      {activeSubTab === 'stories' && (
        <div className="space-y-6">
          {/* Action Bar & Category Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {STORY_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#C86D51] text-white shadow-xs'
                      : 'bg-[#F2ECE1] text-[#6B5E57] hover:bg-[#EAE3D9]'
                  }`}
                >
                  {cat === 'ALL' ? 'All Stories' : cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsSubmitStoryOpen(true)}
              className="px-4 py-2 bg-[#2A2421] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#C86D51]" />
              <span>Share Date / Outing Story</span>
            </button>
          </div>

          {/* Stories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStories.length === 0 && (
              <div className="md:col-span-2 p-10 bg-white border border-[#EAE3D9] rounded-2xl text-center space-y-3">
                <p className="text-sm font-semibold text-[#2A2421]">No stories have been shared yet.</p>
                <p className="text-xs text-[#6B5E57]">Your community’s stories will appear here when people choose to share them.</p>
                <button
                  onClick={() => setIsSubmitStoryOpen(true)}
                  className="px-4 py-2 bg-[#C86D51] text-white rounded-xl text-xs font-semibold hover:bg-[#B75C42]"
                >
                  Share the first story
                </button>
              </div>
            )}
            {filteredStories.map((story) => {
              const isJoined = story.userJoined;
              const commentsOpen = expandedCommentsStoryId === story.id;

              return (
                <div
                  key={story.id}
                  className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-[#D5CDC3] transition-colors"
                >
                  <div className="space-y-4">
                    {/* Header: Category, Type Badge, and Date */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#C86D51]">{story.category}</span>
                        {story.storyType === 'FIRST_DATE' && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[10px] font-semibold border border-rose-100">
                            First Date Advice
                          </span>
                        )}
                        {story.storyType === 'SOLO_DATE' && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md text-[10px] font-semibold border border-amber-100">
                            Solo Date Idea
                          </span>
                        )}
                        {story.storyType === 'COUPLES_OUTING' && (
                          <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded-md text-[10px] font-semibold border border-teal-100">
                            Couples Outing
                          </span>
                        )}
                      </div>
                      <span className="text-[#8C7E74] text-[11px]">
                        {new Date(story.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Title & Author Info */}
                    <div>
                      <h3 className="text-base font-bold text-[#2A2421] font-serif leading-snug">
                        {story.title}
                      </h3>
                      <div className="text-[11px] text-[#6B5E57] mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>Shared by {story.authorAlias}</span>
                        {story.authorContext && (
                          <>
                            <span>·</span>
                            <span>{story.authorContext}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Location or Vibe Snippet */}
                    {story.locationOrVibe && (
                      <div className="flex items-center gap-1.5 text-xs text-[#6B5E57] bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EAE3D9]">
                        <MapPin className="w-3.5 h-3.5 text-[#C86D51] shrink-0" />
                        <span className="font-medium text-[#2A2421]">Vibe & Setting:</span>
                        <span>{story.locationOrVibe}</span>
                      </div>
                    )}

                    {/* 3 Structured Pillars */}
                    <div className="space-y-2.5 text-xs leading-relaxed">
                      <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE3D9] space-y-1">
                        <div className="font-bold uppercase tracking-wider text-[#8C7E74] text-[10px]">
                          The Challenge or Anxiety
                        </div>
                        <p className="text-[#4A3E39]">{story.challenge}</p>
                      </div>

                      <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE3D9] space-y-1">
                        <div className="font-bold uppercase tracking-wider text-[#C86D51] text-[10px]">
                          The Turning Point / Breakthrough
                        </div>
                        <p className="text-[#4A3E39]">{story.turningPoint}</p>
                      </div>

                      <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-100/80 space-y-1 text-teal-950">
                        <div className="font-bold uppercase tracking-wider text-teal-800 text-[10px]">
                          What Helped Most / Advice
                        </div>
                        <p className="text-teal-900 font-medium">{story.keyTakeaway}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions: Join Story, Comments Count, Support */}
                  <div className="space-y-3 pt-3 border-t border-[#EAE3D9]">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      {/* Join Story Button */}
                      <button
                        onClick={() => handleJoinStory(story.id)}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 text-xs ${
                          isJoined
                            ? 'bg-teal-50 text-teal-800 border border-teal-200 font-semibold'
                            : 'bg-[#F2ECE1] text-[#6B5E57] hover:bg-[#EAE3D9]'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>{isJoined ? 'Joined Experience' : 'Join Discussion'}</span>
                        <span className="font-mono tabular-nums text-[11px]">
                          ({story.joinedCount || 1})
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Toggle Comments Button */}
                        <button
                          onClick={() =>
                            setExpandedCommentsStoryId(commentsOpen ? null : story.id)
                          }
                          className="px-3 py-1.5 rounded-xl bg-[#F2ECE1] text-[#6B5E57] hover:bg-[#EAE3D9] font-medium transition-colors flex items-center gap-1.5 text-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Comments</span>
                          <span className="font-mono tabular-nums text-[11px]">
                            ({story.comments?.length || 0})
                          </span>
                        </button>

                        {/* Support Heart Button */}
                        <button
                          onClick={() => handleSupportStory(story.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-colors text-xs ${
                            story.userSupported
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-[#F2ECE1] text-[#6B5E57] hover:bg-[#EAE3D9]'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              story.userSupported ? 'fill-current text-rose-600' : 'text-[#8C7E74]'
                            }`}
                          />
                          <span>{story.userSupported ? 'Supported' : 'Warmth'}</span>
                          <span className="font-mono tabular-nums text-[11px]">
                            ({story.supportCount})
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Comments & Advice Section */}
                    {commentsOpen && (
                      <div className="pt-3 border-t border-[#EAE3D9] space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between text-[11px] text-[#6B5E57]">
                          <span className="font-semibold">
                            Discussion & Advice ({story.comments?.length || 0})
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-teal-800">
                            <Bell className="w-3 h-3" />
                            <span>Participators receive notifications on replies</span>
                          </span>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {story.comments && story.comments.length > 0 ? (
                            story.comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3D9] text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-[10px] text-[#8C7E74]">
                                  <span className="font-bold text-[#2A2421]">
                                    {comment.authorName}
                                  </span>
                                  <span>
                                    {new Date(comment.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-[#4A3E39] text-xs leading-relaxed">
                                  {comment.content}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-center py-2 text-xs text-[#8C7E74] italic">
                              No comments yet. Be the first to share an encouraging note or date tip!
                            </p>
                          )}
                        </div>

                        {/* Comment Input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={storyCommentInputs[story.id] || ''}
                            onChange={(e) =>
                              setStoryCommentInputs({
                                ...storyCommentInputs,
                                [story.id]: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddStoryComment(story.id);
                            }}
                            placeholder="Add advice or suggest an outing idea..."
                            className="flex-1 px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] placeholder:text-[#8C7E74] focus:outline-none focus:border-[#C86D51]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddStoryComment(story.id)}
                            className="p-2 bg-[#C86D51] hover:bg-[#B75C42] text-white rounded-xl transition-colors shrink-0 shadow-xs"
                            title="Send Comment"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Story Modal */}
          {isSubmitStoryOpen && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-[#EAE3D9] max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#2A2421] font-serif">
                      Share Your Date or Outing Journey
                    </h3>
                    <p className="text-xs text-[#6B5E57]">
                      Help others overcome first-date jitters, explore solo self-love, or find creative couples outings.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSubmitStoryOpen(false)}
                    className="p-1 text-[#8C7E74] hover:text-[#2A2421] rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateStory} className="space-y-4 text-xs">
                  {/* Story Type Selector */}
                  <div className="space-y-1">
                    <label className="font-bold text-[#4A3E39] uppercase tracking-wider block">
                      Story Category & Focus
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'FIRST_DATE', label: 'First Date', cat: 'First Dates & Romance' },
                        { id: 'SOLO_DATE', label: 'Solo Outing', cat: 'Solo Dates & Self-Love' },
                        { id: 'COUPLES_OUTING', label: 'Couples Outing', cat: 'Couples Outings' },
                        { id: 'HEALING_JOURNEY', label: 'Healing', cat: 'Healing & Vulnerability' },
                      ].map((type) => (
                        <button
                          type="button"
                          key={type.id}
                          onClick={() => {
                            setStoryType(type.id as any);
                            setStoryCategory(type.cat);
                          }}
                          className={`p-2 rounded-xl text-center border font-medium transition-colors ${
                            storyType === type.id
                              ? 'bg-[#C86D51] text-white border-[#C86D51]'
                              : 'bg-[#FAF7F2] text-[#6B5E57] border-[#EAE3D9] hover:bg-[#F2ECE1]'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] uppercase tracking-wider block mb-1">
                      Story Title
                    </label>
                    <input
                      type="text"
                      required
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      placeholder="e.g., The 45-Minute Indie Bookstore Stroll with a Built-in Exit Time"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] uppercase tracking-wider block mb-1">
                      Outing Location or Atmosphere Vibe
                    </label>
                    <input
                      type="text"
                      value={locationOrVibe}
                      onChange={(e) => setLocationOrVibe(e.target.value)}
                      placeholder="e.g., Cozy tea house with booths, sunset park walk, pottery painting studio"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] uppercase tracking-wider block mb-1">
                      1. The Struggle or Performance Anxiety
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={storyChallenge}
                      onChange={(e) => setStoryChallenge(e.target.value)}
                      placeholder="What made you nervous or overwhelmed?"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] uppercase tracking-wider block mb-1">
                      2. The Turning Point (What made it click or feel safe?)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={storyTurningPoint}
                      onChange={(e) => setStoryTurningPoint(e.target.value)}
                      placeholder="What boundary, conversation opener, or activity dissolved the tension?"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] uppercase tracking-wider block mb-1">
                      3. Key Takeaway or Practical Recommendation
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={storyTakeaway}
                      onChange={(e) => setStoryTakeaway(e.target.value)}
                      placeholder="One piece of advice you’d give to someone trying this..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-[#6B5E57]">
                      <input
                        type="checkbox"
                        checked={isAnonymousStory}
                        onChange={(e) => setIsAnonymousStory(e.target.checked)}
                        className="w-4 h-4 accent-[#C86D51] rounded-sm"
                      />
                      <span>Post as Anonymous Friend</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSubmitStoryOpen(false)}
                        className="px-4 py-2 bg-[#F2ECE1] text-[#6B5E57] rounded-xl hover:bg-[#EAE3D9]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#C86D51] hover:bg-[#B75C42] text-white rounded-xl font-semibold shadow-xs"
                      >
                        Publish Story
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. COMMUNITY CIRCLES & TOPICS TAB                               */}
      {/* ============================================================== */}
      {activeSubTab === 'circles' && !activeCircle && (
        <div className="p-10 bg-white border border-[#EAE3D9] rounded-2xl text-center space-y-3">
          <h3 className="text-sm font-semibold text-[#2A2421]">No community circles are available yet.</h3>
          <p className="text-xs text-[#6B5E57]">
            Approved community topics will appear here. You can suggest one for review{isAdmin ? ' or create a topic as an administrator' : ''}.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setIsSuggestModalOpen(true)}
              className="px-4 py-2 bg-[#FAF7F2] border border-[#EAE3D9] text-[#2A2421] rounded-xl text-xs font-semibold"
            >
              Suggest a topic
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsAdminCreateTopicOpen(true)}
                className="px-4 py-2 bg-[#C86D51] text-white rounded-xl text-xs font-semibold"
              >
                Create a topic
              </button>
            )}
          </div>
        </div>
      )}
      {activeSubTab === 'circles' && activeCircle && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column: Circles Navigation List & Suggestion / Admin actions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B5E57]">
                Community Topics
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setIsAdminCreateTopicOpen(true)}
                  className="text-[11px] font-semibold text-[#C86D51] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Topic</span>
                </button>
              )}
            </div>

            {/* Circles list */}
            <div className="space-y-2">
              {circles.map((circle) => {
                const isSelected = selectedCircleId === circle.id;
                return (
                  <button
                    key={circle.id}
                    onClick={() => setSelectedCircleId(circle.id)}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all border ${
                      isSelected
                        ? 'bg-white border-[#C86D51] shadow-xs'
                        : 'bg-[#FAF7F2] border-[#EAE3D9] hover:bg-white text-[#4A3E39]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#2A2421] font-serif">
                        {circle.name}
                      </span>
                      {circle.isJoined && (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100">
                          Joined
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B5E57] mt-1 line-clamp-2">
                      {circle.description}
                    </p>
                    <div className="mt-2 text-[10px] text-[#8C7E74] font-mono flex items-center justify-between">
                      <span>{circle.memberCount} members</span>
                      <span>{circle.posts.length} discussions</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* User Suggest Community Button */}
            <div className="p-4 bg-gradient-to-br from-[#F5EFE6] to-[#FAF7F2] border border-[#E8DFD5] rounded-2xl text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-[#2A2421]">
                <Lightbulb className="w-4 h-4 text-[#C86D51]" />
                <span>Suggest a Community</span>
              </div>
              <p className="text-[11px] text-[#6B5E57] leading-relaxed">
                Have an idea for a niche circle (e.g. dating over 40, queer solo travels, anxious attachments)? Propose it to our administrators!
              </p>
              <button
                type="button"
                onClick={() => setIsSuggestModalOpen(true)}
                className="w-full py-2 bg-white border border-[#E8DFD5] hover:bg-[#FAF7F2] text-[#2A2421] rounded-xl font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#C86D51]" />
                <span>Suggest Community Topic</span>
              </button>
            </div>

            {/* Safe Haven Rules */}
            <div className="p-4 bg-[#FAF7F2] border border-[#EAE3D9] rounded-2xl text-xs text-[#6B5E57] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#2A2421]">
                <Shield className="w-3.5 h-3.5 text-teal-700" />
                <span>Clinical Moderation Guarantee</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                All community circles are protected by real-time safety guardrails. Harassment or invalidation is flagged immediately for clinical administrator suspension.
              </p>
            </div>
          </div>

          {/* Right 3 Columns: Active Circle Posts Feed & Discussion */}
          <div className="lg:col-span-3 space-y-6">
            {/* Circle Header Banner */}
            <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#2A2421] font-serif">
                    {activeCircle.name}
                  </h3>
                  {activeCircle.createdByAdmin && (
                    <span className="px-2 py-0.5 bg-[#C86D51]/10 text-[#C86D51] text-[10px] font-bold rounded-md border border-[#C86D51]/20">
                      Official Topic
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B5E57] leading-relaxed">
                  {activeCircle.description}
                </p>
                <div className="text-[11px] text-[#8C7E74] font-mono pt-1">
                  {activeCircle.memberCount} members · {activeCircle.posts.length} discussions
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {/* Join / Leave Circle button */}
                <button
                  onClick={() => handleJoinCircle(activeCircle.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    activeCircle.isJoined
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'bg-[#FAF7F2] text-[#4A3E39] border border-[#EAE3D9] hover:bg-[#F2ECE1]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-teal-700" />
                  <span>{activeCircle.isJoined ? 'Joined Circle' : 'Join Circle'}</span>
                </button>

                <button
                  onClick={() => setIsCreatePostOpen(true)}
                  className="px-4 py-2 bg-[#C86D51] text-white rounded-xl text-xs font-semibold hover:bg-[#B75C42] transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start Discussion</span>
                </button>
              </div>
            </div>

            {/* Create Post Form */}
            {isCreatePostOpen && (
              <div className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-2">
                  <h4 className="text-sm font-bold text-[#2A2421] font-serif">
                    Start a Discussion in {activeCircle.name}
                  </h4>
                  <button
                    onClick={() => setIsCreatePostOpen(false)}
                    className="text-xs text-[#8C7E74] hover:text-[#2A2421]"
                  >
                    Cancel
                  </button>
                </div>

                {postError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    {postError}
                  </div>
                )}

                <form onSubmit={handleCreatePost} className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Discussion Title
                    </label>
                    <input
                      type="text"
                      required
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      placeholder="e.g., How do you navigate quiet days without feeling disconnected?"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Share your experience or inquiry
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Share what is on your heart..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-[#6B5E57]">
                      <input
                        type="checkbox"
                        checked={isAnonymousPost}
                        onChange={(e) => setIsAnonymousPost(e.target.checked)}
                        className="w-4 h-4 accent-[#C86D51] rounded-sm"
                      />
                      <span>Post anonymously</span>
                    </label>

                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#C86D51] text-white rounded-xl font-semibold hover:bg-[#B75C42] shadow-xs"
                    >
                      Post to Circle
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Posts List */}
            <div className="space-y-5">
              {activeCircle.posts.length === 0 ? (
                <div className="p-10 bg-white border border-[#EAE3D9] rounded-2xl text-center space-y-2">
                  <p className="text-xs text-[#6B5E57]">
                    No discussions in this circle yet. Be the first to start a gentle, meaningful conversation.
                  </p>
                  <button
                    onClick={() => setIsCreatePostOpen(true)}
                    className="px-3.5 py-1.5 bg-[#C86D51] text-white rounded-xl text-xs font-semibold"
                  >
                    Start Discussion
                  </button>
                </div>
              ) : (
                activeCircle.posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white border border-[#EAE3D9] rounded-2xl p-6 shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-[#2A2421] font-serif">
                          {post.title}
                        </h4>
                        <div className="text-[11px] text-[#8C7E74] flex items-center gap-1.5">
                          <span>{post.authorName}</span>
                          <span>·</span>
                          <span>
                            {new Date(post.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-[#FAF7F2] text-[#6B5E57] rounded-md text-[10px] border border-[#EAE3D9]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-[#4A3E39] leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-[#EAE3D9] text-xs">
                      <button
                        onClick={() => handleSupportPost(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                          post.userSupported
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-[#FAF7F2] text-[#6B5E57] hover:bg-[#F2ECE1]'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            post.userSupported ? 'fill-current text-rose-600' : 'text-[#8C7E74]'
                          }`}
                        />
                        <span>{post.supports} Helpful</span>
                      </button>

                      <span className="text-[11px] text-[#8C7E74]">
                        {post.comments.length} replies
                      </span>
                    </div>

                    {/* Replies */}
                    <div className="space-y-2 pt-2">
                      {post.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="p-3 bg-[#FAF7F2] rounded-xl text-xs border border-[#EAE3D9] space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] text-[#8C7E74]">
                            <span className="font-bold text-[#2A2421]">
                              {comment.authorName}
                            </span>
                            <span>
                              {new Date(comment.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="text-[#4A3E39]">{comment.content}</p>
                        </div>
                      ))}

                      {/* Comment input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={circleCommentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCircleCommentInputs({
                              ...circleCommentInputs,
                              [post.id]: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCircleComment(post.id);
                          }}
                          placeholder="Reply with empathy and support..."
                          className="flex-1 px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCircleComment(post.id)}
                          className="px-3.5 py-2 bg-[#2A2421] text-white rounded-xl text-xs font-semibold hover:bg-stone-800 shadow-xs"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* User Suggest Community Modal */}
          {isSuggestModalOpen && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-[#EAE3D9] max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-[#C86D51]" />
                    <h3 className="text-base font-bold text-[#2A2421] font-serif">
                      Suggest a Community Circle
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsSuggestModalOpen(false)}
                    className="p-1 text-[#8C7E74] hover:text-[#2A2421] rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSuggestCommunity} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Proposed Circle / Topic Name
                    </label>
                    <input
                      type="text"
                      required
                      value={suggestName}
                      onChange={(e) => setSuggestName(e.target.value)}
                      placeholder="e.g., Solo Dating & Radical Self-Romance Haven"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">Category</label>
                    <select
                      value={suggestCategory}
                      onChange={(e) => setSuggestCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    >
                      <option value="Dating & Romance">Dating & Romance</option>
                      <option value="Relationships & Couples">Relationships & Couples</option>
                      <option value="Self-Love & Solo Life">Self-Love & Solo Life</option>
                      <option value="Anxiety & Healing">Anxiety & Healing</option>
                      <option value="Work & Identity">Work & Identity</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Purpose & Safe Space Description
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={suggestDescription}
                      onChange={(e) => setSuggestDescription(e.target.value)}
                      placeholder="Who is this circle for and how does it foster healing?"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Proposed First Conversation Prompt (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={suggestPrompt}
                      onChange={(e) => setSuggestPrompt(e.target.value)}
                      placeholder="e.g., What was your favorite solo date that surprised you with its peace?"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSuggestModalOpen(false)}
                      className="px-4 py-2 bg-[#F2ECE1] text-[#6B5E57] rounded-xl hover:bg-[#EAE3D9]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#C86D51] hover:bg-[#B75C42] text-white rounded-xl font-semibold shadow-xs"
                    >
                      Submit Proposal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Admin Add Community Topic Modal */}
          {isAdminCreateTopicOpen && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-[#EAE3D9] max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#C86D51]" />
                    <h3 className="text-base font-bold text-[#2A2421] font-serif">
                      Admin: Add Official Community Topic
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAdminCreateTopicOpen(false)}
                    className="p-1 text-[#8C7E74] hover:text-[#2A2421] rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAdminCreateTopic} className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Circle Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="e.g., First Dates & Mindful Connection"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">Category</label>
                    <input
                      type="text"
                      required
                      value={newTopicCategory}
                      onChange={(e) => setNewTopicCategory(e.target.value)}
                      placeholder="e.g., Romance & Dating"
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Description & Guidelines
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={newTopicDescription}
                      onChange={(e) => setNewTopicDescription(e.target.value)}
                      placeholder="Clinical guidelines and community focus for this circle..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#4A3E39] block mb-1">
                      Inaugural Kickoff Discussion Prompt
                    </label>
                    <textarea
                      rows={2}
                      value={newTopicPrompt}
                      onChange={(e) => setNewTopicPrompt(e.target.value)}
                      placeholder="Welcome question to spark the first respectful conversation..."
                      className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#EAE3D9] rounded-xl text-xs text-[#2A2421] resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAdminCreateTopicOpen(false)}
                      className="px-4 py-2 bg-[#F2ECE1] text-[#6B5E57] rounded-xl hover:bg-[#EAE3D9]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#C86D51] hover:bg-[#B75C42] text-white rounded-xl font-semibold shadow-xs"
                    >
                      Create Circle
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
