"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { backendRequest } from "@/lib/backend-api";

type ApiReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
};
type ReviewLabels = {
  open: string;
  title: string;
  summary: string;
  rating: string;
  date: string;
  recent: string;
  oldest: string;
  filters: string;
  clear: string;
  empty: string;
  close: string;
};

function Stars({
  rating,
  onSelect,
}: {
  rating: number;
  onSelect?: (value: number) => void;
}) {
  return (
    <span className="review-stars" aria-label={`${rating} sur 5 étoiles`}>
      {Array.from({ length: 5 }, (_, index) => (
        <button
          type="button"
          key={index}
          disabled={!onSelect}
          onClick={() => onSelect?.(index + 1)}
          aria-label={`${index + 1} étoiles`}
        >
          <Star
            fill={index < rating ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      ))}
    </span>
  );
}

export function ProductReviews({
  productId,
  openFromNotification = false,
  labels,
}: {
  productId: string;
  openFromNotification?: boolean;
  labels: ReviewLabels;
}) {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [open, setOpen] = useState(openFromNotification);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest">("recent");
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{ count: number; average: number | null }>({ count: 0, average: null });

  useEffect(() => {
    backendRequest<ApiReview[]>(`/reviews/product/${productId}`)
      .then(setReviews)
      .catch(() => setReviews([]));
    backendRequest<{ count: number; average: number | null }>(`/reviews/product/${productId}/summary`)
      .then(setSummary)
      .catch(() => undefined);
  }, [productId]);

  const filteredReviews = useMemo(
    () =>
      reviews
        .filter(
          (review) =>
            selectedRatings.length === 0 ||
            selectedRatings.includes(review.rating),
        )
        .sort((a, b) =>
          sort === "recent"
            ? b.createdAt.localeCompare(a.createdAt)
            : a.createdAt.localeCompare(b.createdAt),
        ),
    [reviews, selectedRatings, sort],
  );
  const average = summary.average ?? 0;

  const submitReview = async () => {
    if (!rating || !comment.trim())
      return setError("Sélectionnez une note et écrivez un commentaire.");
    setSubmitting(true);
    setError("");
    try {
      await backendRequest<ApiReview>("/reviews", {
        method: "POST",
        body: JSON.stringify({ productId, rating, comment: comment.trim() }),
      });
      setOpen(false);
      setRating(0);
      setComment("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible d'envoyer l'avis.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="reviews" className="product-reviews section">
      <div className="review-summary-header">
        <div>
          <span className="eyebrow">{labels.summary}</span>
          <div className="review-score-line">
            <strong>{average ? average.toFixed(1) : "-"}</strong>
            <Stars rating={Math.round(average)} />
            <small>{summary.count} avis vérifiés</small>
          </div>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          {labels.open}
        </Button>
      </div>
      <div className="review-preview-grid">
        {filteredReviews.slice(0, 3).map((review) => (
          <article className="review-preview-card" key={review.id}>
            <Stars rating={review.rating} />
            <p>« {review.comment} »</p>
            <strong>Client vérifié</strong>
          </article>
        ))}
        {filteredReviews.length === 0 && (
          <p className="reviews-empty">{labels.empty}</p>
        )}
      </div>
      <div className="reviews-dialog-list">
        <div className="review-filter-group">
          <span>{labels.rating}</span>
          {[5, 4, 3, 2, 1].map((value) => (
            <label key={value}>
              <Checkbox
                checked={selectedRatings.includes(value)}
                onCheckedChange={() =>
                  setSelectedRatings((current) =>
                    current.includes(value)
                      ? current.filter((item) => item !== value)
                      : [...current, value],
                  )
                }
              />
              <Stars rating={value} />
            </label>
          ))}
        </div>
        {filteredReviews.map((review) => (
          <article className="full-review" key={review.id}>
            <div className="full-review-top">
              <Stars rating={review.rating} />
              <time dateTime={review.createdAt}>
                <CalendarDays aria-hidden="true" />
                {new Intl.DateTimeFormat("fr-CM", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(review.createdAt))}
              </time>
            </div>
            <p>« {review.comment} »</p>
            <strong>Client vérifié</strong>
          </article>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>
              Votre expérience aide les autres clients à choisir leur modèle.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium">{labels.rating}</p>
              <Stars rating={rating} onSelect={setRating} />
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              placeholder="Votre avis"
              className="w-full rounded-md border p-3"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {labels.close}
            </Button>
            <Button disabled={submitting} onClick={submitReview}>
              {submitting ? "Envoi..." : "Publier mon avis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
