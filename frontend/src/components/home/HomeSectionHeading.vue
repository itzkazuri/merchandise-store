<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

withDefaults(
  defineProps<{
    titleId?: string
    title: string
    description?: string
    actionLabel?: string
    actionTo?: string
    inverse?: boolean
  }>(),
  { inverse: false },
)
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2
        :id="titleId"
        :class="[
          'font-head text-2xl sm:text-3xl md:text-4xl font-bold leading-tight',
          inverse ? 'text-bg' : 'text-ink',
        ]"
      >
        {{ title }}
      </h2>
      <p
        v-if="description"
        :class="[
          'mt-1.5 max-w-xl text-sm sm:text-base font-semibold',
          inverse ? 'text-bg/65' : 'text-ink/60',
        ]"
      >
        {{ description }}
      </p>
    </div>

    <slot name="actions">
      <RouterLink
        v-if="actionTo && actionLabel"
        :to="actionTo"
        :class="[
          'inline-flex items-center gap-1.5 text-sm font-extrabold transition-colors',
          inverse ? 'text-bg/70 hover:text-bg' : 'text-ink/65 hover:text-ink',
        ]"
      >
        {{ actionLabel }} <ArrowRight :size="15" />
      </RouterLink>
    </slot>
  </div>
</template>
