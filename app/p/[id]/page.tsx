import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentSection } from "@/components/comment-section";
import { PostCard } from "@/components/post-card";
import { getActiveSession } from "@/lib/auth";
import { getComments, getPost } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getActiveSession();
  const viewerId = session?.user.id ?? null;
  const post = getPost(id, viewerId);
  if (!post) notFound();
  const comments = getComments(id);

  return (
    <div className="detail-page">
      <Link className="back-link" href="/">
        ← 回到广场
      </Link>
      <PostCard post={post} currentUserId={viewerId} showLink={false} />
      <CommentSection
        postId={id}
        comments={comments}
        currentUserId={viewerId}
        readOnly={post.status === "hidden"}
      />
    </div>
  );
}
