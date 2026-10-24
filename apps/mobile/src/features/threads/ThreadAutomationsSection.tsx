import { useAtomValue } from "@effect/atom-react";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type ScheduledTask,
  type ThreadId,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import * as Dialog from "../../components/ui/Dialog";
import { ListSection } from "../../components/ui/ListSection";
import { Menu } from "../../components/ui/Menu";
import { ThemedSwitch } from "../../components/ui/ThemedSwitch";
import { cn } from "../../lib/cn";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { readEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { startScheduledTaskEditor } from "../settings/scheduled-task-editor-state";
import { editDraft } from "../settings/scheduledTaskDraft";
import { scheduledTaskSummary } from "../settings/scheduledTaskPresentation";

export function ThreadAutomationsSection(props: {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly threadId: ThreadId;
}) {
  const { environmentId } = props;
  const navigation = useNavigation();
  const tasksQuery = useEnvironmentQuery(
    serverEnvironment.scheduledTasksLive({ environmentId, input: {} }),
  );
  const canToggle = useAtomValue(
    serverEnvironment.setScheduledTaskEnabled.permissionAtom(environmentId),
  );
  const canRun = useAtomValue(serverEnvironment.runScheduledTaskNow.permissionAtom(environmentId));
  const setEnabled = useAtomCommand(serverEnvironment.setScheduledTaskEnabled, {
    label: "thread automation toggle",
    reportFailure: false,
  });
  const runNow = useAtomCommand(serverEnvironment.runScheduledTaskNow, {
    label: "thread automation run now",
    reportFailure: false,
  });
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const boundTasks = (tasksQuery.data?.tasks ?? []).filter(
    (task) => task.threadId === props.threadId,
  );
  if (tasksQuery.error === null && boundTasks.length === 0) return null;

  const act = async (
    task: ScheduledTask,
    failureTitle: string,
    run: () => Promise<AtomCommandResult<unknown, unknown>>,
  ) => {
    if (
      busyTaskId !== null ||
      !readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)
    ) {
      return;
    }
    setBusyTaskId(task.id);
    const result = await run();
    setBusyTaskId(null);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      Dialog.alert(failureTitle, String(squashAtomCommandFailure(result)));
    }
  };

  const openEditor = (task: ScheduledTask) => {
    startScheduledTaskEditor({
      environmentId,
      environmentLabel: props.environmentLabel,
      draft: editDraft(task),
    });
    navigation.navigate("SettingsSheet", {
      screen: "SettingsContent",
      params: { screen: "SettingsScheduledTaskEdit" },
    });
  };

  return (
    <ListSection
      title="Automations"
      trailing={
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Manage scheduled tasks"
          hitSlop={8}
          className="px-4 active:opacity-70"
          onPress={() =>
            navigation.navigate("SettingsSheet", {
              screen: "SettingsContent",
              params: { screen: "SettingsScheduledTasks" },
            })
          }
        >
          <Text textRole="footnote" className="font-t3-medium text-foreground-secondary">
            Manage
          </Text>
        </Pressable>
      }
    >
      {tasksQuery.error !== null ? (
        <Text className="p-4 text-sm text-danger-foreground">
          Could not load automations: {tasksQuery.error}
        </Text>
      ) : null}
      {boundTasks.map((task, index) => (
        <View
          key={task.id}
          className={cn(
            "flex-row items-center gap-1 pr-2",
            index < boundTasks.length - 1 && "border-b border-border-subtle",
          )}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
            className="min-w-0 flex-1 gap-1 py-3 pl-4 active:opacity-70"
            onPress={() => openEditor(task)}
          >
            <Text textRole="body" className="text-foreground" numberOfLines={1}>
              {task.title}
            </Text>
            <Text textRole="footnote" className="text-foreground-muted" numberOfLines={2}>
              {scheduledTaskSummary(task, now)}
            </Text>
            {task.lastRunError ? (
              <Text textRole="footnote" className="text-danger-foreground" numberOfLines={2}>
                Last run failed: {task.lastRunError}
              </Text>
            ) : null}
          </Pressable>
          <ThemedSwitch
            accessibilityLabel={task.enabled ? `Pause ${task.title}` : `Resume ${task.title}`}
            disabled={!canToggle || busyTaskId !== null}
            value={task.enabled}
            onValueChange={(enabled) =>
              void act(task, "Could not update task", () =>
                // Partial update, so a toggle cannot revert concurrent edits to the task.
                setEnabled({ environmentId, input: { id: task.id, enabled } }),
              )
            }
          />
          {/* A webhook task runs from its URL; there is no request to run it with. */}
          {task.schedule.type === "webhook" ? null : (
            <Menu
              actions={[
                {
                  id: "run",
                  title: "Run now",
                  attributes: {
                    disabled: !canRun || busyTaskId !== null || task.lastRunStatus === "running",
                  },
                },
              ]}
              onPressAction={() =>
                void act(task, "Could not run task", () =>
                  runNow({ environmentId, input: { id: task.id } }),
                )
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Actions for ${task.title}`}
                className="h-11 w-9 items-center justify-center"
              >
                <SymbolView
                  name="ellipsis"
                  size={18}
                  tintColorClassName="accent-icon"
                  type="monochrome"
                />
              </Pressable>
            </Menu>
          )}
        </View>
      ))}
    </ListSection>
  );
}
