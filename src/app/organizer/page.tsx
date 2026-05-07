import { TopBar } from "@/components/destify/topbar";
import { TripHeader } from "@/components/destify/trip-header";
import { TimelinePanel } from "@/components/destify/timeline-panel";
import { RouteMap } from "@/components/destify/route-map";
import { RightRail } from "@/components/destify/right-rail";
import { FlowModal } from "@/components/destify/flow-modal";

export default function OrganizerPage() {
  return (
    <>
      <TopBar />
      <TripHeader />
      <main className="grid grid-cols-1 items-start gap-4 px-7 pb-10 pt-2 lg:grid-cols-[420px_1fr] xl:grid-cols-[420px_1fr_360px]">
        <TimelinePanel />
        <RouteMap />
        <div className="xl:sticky xl:top-[76px] xl:max-h-[calc(100vh-92px)] xl:overflow-y-auto xl:pr-1">
          <RightRail />
        </div>
      </main>
      <FlowModal />
    </>
  );
}
