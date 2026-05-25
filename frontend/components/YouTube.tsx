export function YouTube({ id }: { id: string }) {
  return (
    <iframe
      className="w-full md:max-w-[720px] mx-auto aspect-video"
      src={`https://www.youtube.com/embed/${id}`}
      title="YouTube Video"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    ></iframe>
  );
}
