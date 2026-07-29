package com.ringmap.nav;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.ViewModel;

public final class NavStateViewModel extends ViewModel {
    private final NavStateRepository repository = NavStateRepository.get();

    public LiveData<NavUiState> state() {
        return repository.state();
    }

    public NavUiState current() {
        return repository.current();
    }
}
