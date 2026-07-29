package com.ringmap.nav.ui;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.ringmap.nav.NavEvent;
import com.ringmap.nav.R;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

final class DiagnosticsAdapter extends RecyclerView.Adapter<DiagnosticsAdapter.EventHolder> {

    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss", Locale.ROOT);
    private List<NavEvent> events = Collections.emptyList();

    void submit(List<NavEvent> value) {
        events = value == null ? Collections.emptyList() : new ArrayList<>(value);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public EventHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_diagnostic_event, parent, false);
        return new EventHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull EventHolder holder, int position) {
        NavEvent event = events.get(position);
        holder.time.setText(timeFormat.format(new Date(event.timestamp)));
        holder.category.setText(event.category);
        holder.message.setText(event.message);
    }

    @Override
    public int getItemCount() {
        return events.size();
    }

    static final class EventHolder extends RecyclerView.ViewHolder {
        final TextView time;
        final TextView category;
        final TextView message;

        EventHolder(@NonNull View itemView) {
            super(itemView);
            time = itemView.findViewById(R.id.tvEventTime);
            category = itemView.findViewById(R.id.tvEventCategory);
            message = itemView.findViewById(R.id.tvEventMessage);
        }
    }
}
