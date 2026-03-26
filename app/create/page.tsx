import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateEventForm } from "@/components/create-event-form";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
      <CreateEventForm />
    </div>
  );
}
