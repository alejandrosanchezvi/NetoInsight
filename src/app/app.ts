// 🚀 NetoInsight - App Component

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationModal } from './shared/components/notification-modal/notification-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,NotificationModal],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  title = 'NetoInsight';
}